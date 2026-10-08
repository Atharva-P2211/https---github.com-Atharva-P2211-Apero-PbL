/**
 * URL parsing and normalization utilities.
 * Strictly enforces the product guarantee: NEVER fetch or render target URLs.
 */

export interface NormalizedUrlResult {
  rawUrl: string;
  normalizedUrl: string;
  hostname: string;
  registrableDomain: string;
  tld: string;
  isIpAddress: boolean;
}

export function parseAndNormalizeUrl(rawInput: string): NormalizedUrlResult {
  let trimmed = rawInput.trim();

  // Ensure scheme exists for URL parser
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'http://' + trimmed;
  }

  const parsed = new URL(trimmed);

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs are permitted.');
  }

  const hostname = parsed.hostname.toLowerCase();
  
  // Check if hostname is an IPv4 or IPv6 address
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const isIp = ipv4Regex.test(hostname) || hostname.includes(':');

  // Basic registrable domain extraction (eTLD+1 heuristic)
  let registrableDomain = hostname;
  let tld = '';

  if (!isIp) {
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      tld = parts[parts.length - 1];
      const secondLevelTlds = ['co.uk', 'gov.uk', 'ac.uk', 'com.au', 'net.au', 'co.in', 'gov.in'];
      const lastTwo = parts.slice(-2).join('.');
      if (secondLevelTlds.includes(lastTwo) && parts.length >= 3) {
        registrableDomain = parts.slice(-3).join('.');
      } else {
        registrableDomain = parts.slice(-2).join('.');
      }
    }
  }

  // Build clean normalized URL
  const normalizedUrl = `${parsed.protocol}//${hostname}${parsed.port ? ':' + parsed.port : ''}${parsed.pathname}${parsed.search}`;

  return {
    rawUrl: rawInput,
    normalizedUrl,
    hostname,
    registrableDomain,
    tld,
    isIpAddress: isIp,
  };
}
