import { GeoLite2Result } from '../lib/types';
import { getFromCache, setInCache } from '../lib/cache';
import fs from 'fs';
import path from 'path';

const KNOWN_CDNS: { asn?: number; matchText?: string; provider: string }[] = [
  { asn: 13335, provider: 'Cloudflare' },
  { asn: 209242, provider: 'Cloudflare' },
  { asn: 16509, matchText: 'amazon', provider: 'Amazon CloudFront / AWS' },
  { asn: 14618, matchText: 'amazon', provider: 'Amazon CloudFront / AWS' },
  { asn: 20940, provider: 'Akamai' },
  { asn: 16625, provider: 'Akamai' },
  { asn: 54113, provider: 'Fastly' },
  { matchText: 'cloudflare', provider: 'Cloudflare' },
  { matchText: 'akamai', provider: 'Akamai' },
  { matchText: 'fastly', provider: 'Fastly' },
];

export async function resolveDnsA(hostname: string): Promise<string[]> {
  try {
    const resolverUrl = process.env.DNS_RESOLVER_URL || 'https://cloudflare-dns.com/dns-query';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${resolverUrl}?name=${encodeURIComponent(hostname)}&type=A`, {
      headers: {
        accept: 'application/dns-json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return [];
    }

    const data: any = await res.json();
    if (Array.isArray(data.Answer)) {
      return data.Answer.filter((ans: any) => ans.type === 1).map((ans: any) => ans.data);
    }
  } catch (err) {
    console.warn(`[DNS] Failed to resolve A record for ${hostname}`);
  }

  return [];
}

let asnReader: any = null;
let countryReader: any = null;
let readersInitialized = false;

function initReaders() {
  if (readersInitialized) return;
  readersInitialized = true;

  try {
    const mmdb = require('mmdb-lib');

    const asnPath = process.env.GEOLITE2_ASN_PATH || path.join(process.cwd(), 'data', 'geolite2', 'GeoLite2-ASN.mmdb');
    const countryPath = process.env.GEOLITE2_COUNTRY_PATH || path.join(process.cwd(), 'data', 'geolite2', 'GeoLite2-Country.mmdb');

    if (fs.existsSync(asnPath)) {
      const buffer = fs.readFileSync(asnPath);
      asnReader = new mmdb.Reader(buffer);
    }
    if (fs.existsSync(countryPath)) {
      const buffer = fs.readFileSync(countryPath);
      countryReader = new mmdb.Reader(buffer);
    }
  } catch (err) {
    // Local .mmdb fallback
  }
}

export async function geolite2Lookup(ip: string): Promise<GeoLite2Result> {
  const cacheKey = `geo:${ip.trim()}`;
  const cached = await getFromCache<GeoLite2Result>(cacheKey);
  if (cached) {
    return cached;
  }

  initReaders();

  let asn: number | undefined;
  let asnOrg: string | undefined;
  let country: string | undefined;
  let countryCode: string | undefined;

  if (asnReader) {
    try {
      const record = asnReader.get(ip);
      if (record) {
        asn = record.autonomous_system_number;
        asnOrg = record.autonomous_system_organization;
      }
    } catch (e) {
      // Lookup ignore
    }
  }

  if (countryReader) {
    try {
      const record = countryReader.get(ip);
      if (record) {
        country = record.country?.names?.en;
        countryCode = record.country?.iso_code;
      }
    } catch (e) {
      // Lookup ignore
    }
  }

  let likelyCdn = false;
  let cdnProvider: string | undefined;

  for (const cdn of KNOWN_CDNS) {
    if (cdn.asn && asn === cdn.asn) {
      likelyCdn = true;
      cdnProvider = cdn.provider;
      break;
    }
    if (cdn.matchText && asnOrg && asnOrg.toLowerCase().includes(cdn.matchText)) {
      likelyCdn = true;
      cdnProvider = cdn.provider;
      break;
    }
  }

  const result: GeoLite2Result = {
    status: (asn || country) ? 'ok' : 'not_found',
    ip,
    asn,
    asn_org: asnOrg,
    country,
    country_code: countryCode,
    likely_cdn: likelyCdn,
    cdn_provider: cdnProvider,
  };

  await setInCache(cacheKey, result, 21600);
  return result;
}
