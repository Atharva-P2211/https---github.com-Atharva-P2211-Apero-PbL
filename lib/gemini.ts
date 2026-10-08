import { GoogleGenerativeAI } from '@google/generative-ai';

// Pricing constants for gemini-2.5-flash (USD per 1M tokens)
const COST_PER_MILLION_INPUT = 0.075;
const COST_PER_MILLION_OUTPUT = 0.30;

export function calculateCost(promptTokens: number, candidatesTokens: number): number {
  const inputCost = (promptTokens / 1_000_000) * COST_PER_MILLION_INPUT;
  const outputCost = (candidatesTokens / 1_000_000) * COST_PER_MILLION_OUTPUT;
  return Number((inputCost + outputCost).toFixed(6));
}

export const APERIO_SYSTEM_INSTRUCTION = `
You are Aperio, an elite infrastructure forensic cybersecurity agent specialized in detecting cloaked phishing attacks.
CRITICAL MANDATES:
1. You inspect ONLY domain, registration, network, DNS, and hosting infrastructure.
2. NEVER attempt to fetch, render, or analyze webpage HTML/DOM content.
3. You have two deterministic forensic tools available:
   - rdap_lookup: Fetches registration dates, registrar, and privacy status.
   - geolite2_lookup: Resolves IP ASN, organization, and geographic jurisdiction.
4. CDN Flagging: When likely_cdn is true (e.g. Cloudflare, AWS CloudFront, Fastly), do NOT treat the CDN ASN itself as malicious. Instead, recognize that infrastructure signals are obscured behind a reverse proxy. Focus on domain age, TLD reputation, and suspicious patterns.
5. High Risk Indicators:
   - Very newly registered domains (<30 days old).
   - High-abuse free or cheap TLDs combined with suspicious subdomains.
   - Nameserver inconsistencies or disposable hosting.
6. Return structured verdicts: "benign", "suspicious", or "malicious", accompanied by calibrated confidence (0.0 to 1.0) and forensic reasoning.
`;

export function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  
  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: APERIO_SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });
}
