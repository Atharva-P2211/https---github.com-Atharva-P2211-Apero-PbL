import { parseAndNormalizeUrl } from './url';
import { rdapLookup } from '../tools/rdap';
import { geolite2Lookup, resolveDnsA } from '../tools/geolite2';
import { getFromCache, setInCache, getDemoFixture } from './cache';
import { queryDb } from './db';
import { getGeminiModel, calculateCost } from './gemini';
import { AnalyzeResponse, RdapResult, GeoLite2Result } from './types';

export async function orchestrateAnalysis(
  rawUrl: string,
  options: { bypassCache?: boolean } = {}
): Promise<AnalyzeResponse> {
  const startTime = Date.now();
  const normalized = parseAndNormalizeUrl(rawUrl);
  const cacheKey = `verdict:${normalized.normalizedUrl}`;

  // 1. Check Full-Verdict Cache
  if (!options.bypassCache) {
    const cachedVerdict = await getFromCache<AnalyzeResponse>(cacheKey);
    if (cachedVerdict) {
      return {
        ...cachedVerdict,
        latency: Date.now() - startTime,
        cache_hit: true,
      };
    }
  }

  // 2. Pre-fetch deterministic forensic tools
  let rdapData: RdapResult | null = null;
  let geoData: GeoLite2Result | null = null;
  let resolvedIps: string[] = [];

  try {
    const [rdapRes, ips] = await Promise.all([
      rdapLookup(normalized.registrableDomain),
      normalized.isIpAddress ? Promise.resolve([normalized.hostname]) : resolveDnsA(normalized.hostname),
    ]);

    rdapData = rdapRes;
    resolvedIps = ips;

    if (resolvedIps.length > 0) {
      geoData = await geolite2Lookup(resolvedIps[0]);
    }
  } catch (err) {
    console.warn('[Orchestrator] Error running pre-tool lookups:', err);
  }

  // 3. Fallback demo fixture
  const fallbackDemo = getDemoFixture(normalized.normalizedUrl);

  let finalVerdict: 'benign' | 'suspicious' | 'malicious' = 'benign';
  let confidence = 0.5;
  let reasoning = '';
  let cost = 0.0;
  let degradedNotice: string | undefined;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    if (fallbackDemo) {
      return fallbackDemo;
    }
    const isNewDomain = (rdapData?.age_days !== undefined && rdapData.age_days < 30);
    finalVerdict = isNewDomain ? 'suspicious' : 'benign';
    confidence = isNewDomain ? 0.75 : 0.85;
    reasoning = `Domain ${normalized.registrableDomain} evaluated using infrastructure signals: age ${rdapData?.age_days ?? 'unknown'} days, ASN ${geoData?.asn_org ?? 'unknown'} (${geoData?.country ?? 'unknown'}).`;
    degradedNotice = 'gemini_key_missing_simulated_verdict';
  } else {
    try {
      const model = getGeminiModel();

      const promptPayload = `
Analyze the infrastructure of the following target URL:
Target URL: ${normalized.normalizedUrl}
Domain: ${normalized.registrableDomain}
Host: ${normalized.hostname}

Forensic Evidence Collected:
RDAP Data:
${JSON.stringify(rdapData, null, 2)}

DNS & Network GeoLite2 Data:
Resolved IPs: ${JSON.stringify(resolvedIps)}
GeoLite2 Lookup:
${JSON.stringify(geoData, null, 2)}

Provide your forensic verdict in valid JSON conforming to:
{
  "verdict": "benign" | "suspicious" | "malicious",
  "confidence": number between 0.0 and 1.0,
  "reasoning": "Concise infrastructure-focused justification"
}
`;

      const result = await model.generateContent(promptPayload);
      const text = result.response.text() || '{}';
      const parsed = JSON.parse(text);

      finalVerdict = parsed.verdict || 'benign';
      confidence = parsed.confidence ?? 0.7;
      reasoning = parsed.reasoning || 'Infrastructure analysis complete.';

      const usage = result.response.usageMetadata;
      if (usage) {
        cost = calculateCost(usage.promptTokenCount || 0, usage.candidatesTokenCount || 0);
      }
    } catch (err: any) {
      console.error('[Orchestrator] Gemini invocation failed:', err);
      if (fallbackDemo) {
        return fallbackDemo;
      }
      degradedNotice = 'gemini_unavailable';
      finalVerdict = (rdapData?.age_days !== undefined && rdapData.age_days < 14) ? 'suspicious' : 'benign';
      confidence = 0.6;
      reasoning = `Service degraded. Fallback verdict based purely on domain age (${rdapData?.age_days ?? 'unknown'} days).`;
    }
  }

  const latency = Date.now() - startTime;

  const responseResult: AnalyzeResponse = {
    verdict: finalVerdict,
    confidence,
    reasoning,
    latency,
    cost,
    cache_hit: false,
    degraded: degradedNotice,
    details: {
      normalized_url: normalized.normalizedUrl,
      domain: normalized.registrableDomain,
      resolved_ips: resolvedIps,
      rdap: rdapData,
      geo: geoData,
      cdn_detected: geoData?.likely_cdn || false,
    },
  };

  const verdictTtl = parseInt(process.env.VERDICT_CACHE_TTL_SECONDS || '21600', 10);
  await setInCache(cacheKey, responseResult, verdictTtl);

  try {
    await queryDb(
      `INSERT INTO request_logs (url, domain, verdict, confidence, reasoning, latency_ms, cost_usd, cache_hit, model, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        normalized.normalizedUrl,
        normalized.registrableDomain,
        finalVerdict,
        confidence,
        reasoning,
        latency,
        cost,
        false,
        process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        degradedNotice || null,
      ]
    );
  } catch (err) {
    // DB logging fallback
  }

  return responseResult;
}
