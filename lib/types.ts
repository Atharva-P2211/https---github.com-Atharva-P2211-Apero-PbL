import { z } from 'zod';

export const VerdictEnum = z.enum(['benign', 'suspicious', 'malicious']);
export type Verdict = z.infer<typeof VerdictEnum>;

// Core data contract schema as required by the TRD
export const AnalyzeResponseSchema = z.object({
  verdict: VerdictEnum,
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  latency: z.number(), // Latency in milliseconds
  cost: z.number(),    // Estimated USD cost
  cache_hit: z.boolean().default(false),
  details: z.object({
    normalized_url: z.string(),
    domain: z.string(),
    resolved_ips: z.array(z.string()).default([]),
    rdap: z.record(z.any()).nullable().default(null),
    geo: z.record(z.any()).nullable().default(null),
    cdn_detected: z.boolean().default(false),
  }).optional(),
  degraded: z.string().optional(),
});

export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

export const AnalyzeRequestSchema = z.object({
  url: z.string().url('A valid HTTP or HTTPS URL is required'),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

// Tool result schemas
export interface RdapResult {
  status: 'ok' | 'not_found' | 'timeout' | 'error';
  domain: string;
  registrar?: string;
  registration_date?: string;
  expiration_date?: string;
  nameservers?: string[];
  privacy_redacted: boolean;
  age_days?: number;
  raw_events?: Record<string, string>;
  error?: string;
}

export interface GeoLite2Result {
  status: 'ok' | 'not_found' | 'error';
  ip: string;
  asn?: number;
  asn_org?: string;
  country?: string;
  country_code?: string;
  likely_cdn: boolean;
  cdn_provider?: string;
  error?: string;
}
