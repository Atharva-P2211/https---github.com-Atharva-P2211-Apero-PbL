import { RdapResult } from '../lib/types';
import { getFromCache, setInCache } from '../lib/cache';

const DEFAULT_TIMEOUT_MS = 3000;
const BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';

interface IanaBootstrap {
  services: [string[], string[]][];
}

let cachedBootstrap: IanaBootstrap | null = null;
let bootstrapExpiresAt = 0;

async function getIanaBootstrap(): Promise<IanaBootstrap | null> {
  const now = Date.now();
  if (cachedBootstrap && bootstrapExpiresAt > now) {
    return cachedBootstrap;
  }

  const cached = await getFromCache<IanaBootstrap>('rdap:iana_bootstrap');
  if (cached) {
    cachedBootstrap = cached;
    bootstrapExpiresAt = now + 86400 * 1000;
    return cachedBootstrap;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(BOOTSTRAP_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (resp.ok) {
      const data: IanaBootstrap = await resp.json();
      cachedBootstrap = data;
      bootstrapExpiresAt = now + 86400 * 1000;
      await setInCache('rdap:iana_bootstrap', data, 86400);
      return data;
    }
  } catch (err) {
    console.warn('[RDAP] Failed to fetch IANA bootstrap:', err);
  }

  return null;
}

async function getRdapBaseUrlForTld(tld: string): Promise<string | null> {
  const bootstrap = await getIanaBootstrap();
  if (!bootstrap || !bootstrap.services) {
    const fallbacks: Record<string, string> = {
      com: 'https://rdap.verisign.com/com/v1/',
      net: 'https://rdap.verisign.com/net/v1/',
      org: 'https://rdap.publicinterestregistry.org/rdap/',
      io: 'https://rdap.identitydigital.services/rdap/',
      dev: 'https://rdap.google.com/',
      app: 'https://rdap.google.com/',
    };
    return fallbacks[tld] || null;
  }

  for (const [tlds, urls] of bootstrap.services) {
    if (tlds.includes(tld)) {
      return urls[0].endsWith('/') ? urls[0] : `${urls[0]}/`;
    }
  }

  return null;
}

export async function rdapLookup(registrableDomain: string): Promise<RdapResult> {
  const cacheKey = `rdap:${registrableDomain.toLowerCase()}`;
  const cached = await getFromCache<RdapResult>(cacheKey);
  if (cached) {
    return cached;
  }

  const parts = registrableDomain.toLowerCase().split('.');
  const tld = parts[parts.length - 1];

  const baseUrl = await getRdapBaseUrlForTld(tld);
  if (!baseUrl) {
    return {
      status: 'not_found',
      domain: registrableDomain,
      privacy_redacted: false,
      error: `No RDAP server discovered for TLD .${tld}`,
    };
  }

  const queryUrl = `${baseUrl}domain/${registrableDomain}`;
  const controller = new AbortController();
  const timeoutMs = parseInt(process.env.RDAP_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(queryUrl, {
      headers: {
        Accept: 'application/rdap+json, application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 404) {
      const negativeResult: RdapResult = {
        status: 'not_found',
        domain: registrableDomain,
        privacy_redacted: false,
        error: 'Domain not found in RDAP registry',
      };
      await setInCache(cacheKey, negativeResult, 900);
      return negativeResult;
    }

    if (!res.ok) {
      return {
        status: 'error',
        domain: registrableDomain,
        privacy_redacted: false,
        error: `RDAP server returned HTTP status ${res.status}`,
      };
    }

    const data: any = await res.json();

    let registrar: string | undefined;
    if (Array.isArray(data.entities)) {
      for (const ent of data.entities) {
        if (Array.isArray(ent.roles) && ent.roles.includes('registrar')) {
          registrar = ent.vcardArray?.[1]?.find((f: any) => f[0] === 'fn')?.[3] || ent.handle;
          break;
        }
      }
    }

    let registrationDate: string | undefined;
    let expirationDate: string | undefined;
    const rawEvents: Record<string, string> = {};

    if (Array.isArray(data.events)) {
      for (const ev of data.events) {
        if (ev.eventAction && ev.eventDate) {
          rawEvents[ev.eventAction] = ev.eventDate;
          if (ev.eventAction === 'registration') {
            registrationDate = ev.eventDate;
          } else if (ev.eventAction === 'expiration') {
            expirationDate = ev.eventDate;
          }
        }
      }
    }

    const nameservers: string[] = [];
    if (Array.isArray(data.nameservers)) {
      for (const ns of data.nameservers) {
        if (ns.ldhName) nameservers.push(ns.ldhName.toLowerCase());
      }
    }

    const serialized = JSON.stringify(data).toLowerCase();
    const privacyRedacted =
      serialized.includes('redacted') ||
      serialized.includes('privacy') ||
      serialized.includes('whoisguard') ||
      serialized.includes('withheld for privacy');

    let ageDays: number | undefined;
    if (registrationDate) {
      const regTime = new Date(registrationDate).getTime();
      if (!isNaN(regTime)) {
        ageDays = Math.max(0, Math.floor((Date.now() - regTime) / (1000 * 60 * 60 * 24)));
      }
    }

    const result: RdapResult = {
      status: 'ok',
      domain: registrableDomain,
      registrar,
      registration_date: registrationDate,
      expiration_date: expirationDate,
      nameservers,
      privacy_redacted: privacyRedacted,
      age_days: ageDays,
      raw_events: rawEvents,
    };

    await setInCache(cacheKey, result, 86400);
    return result;
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    const errorResult: RdapResult = {
      status: isTimeout ? 'timeout' : 'error',
      domain: registrableDomain,
      privacy_redacted: false,
      error: isTimeout ? 'RDAP query timed out' : (err.message || 'Unknown RDAP error'),
    };

    await setInCache(cacheKey, errorResult, 900);
    return errorResult;
  }
}
