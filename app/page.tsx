'use client';

import React, { useState } from 'react';
import { AnalyzeResponse } from '@/lib/types';

export default function CheckerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze URL');
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const setPreset = (target: string) => {
    setUrl(target);
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'malicious':
        return <span className="px-3 py-1 bg-red-500/20 border border-red-500/50 text-red-400 font-bold uppercase rounded-md text-sm">Malicious</span>;
      case 'suspicious':
        return <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 font-bold uppercase rounded-md text-sm">Suspicious</span>;
      default:
        return <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold uppercase rounded-md text-sm">Benign</span>;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Infrastructure Forensic Checker</h1>
        <p className="text-neutral-400 text-sm">
          Inspects domain age, RDAP registry events, DNS records, and GeoLite2 network provenance without ever fetching webpage HTML.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="e.g. https://secure-login-wellsfargo.verify-alerts-sec.top/auth"
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500 font-mono text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-6 py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span>Quick demo fixtures:</span>
          <button
            type="button"
            onClick={() => setPreset('https://secure-login-wellsfargo.verify-alerts-sec.top/auth')}
            className="text-neutral-400 hover:text-cyan-400 underline underline-offset-2"
          >
            Cloaked Phish Lure
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => setPreset('https://github.com/explore')}
            className="text-neutral-400 hover:text-cyan-400 underline underline-offset-2"
          >
            Legitimate Domain
          </button>
        </div>
      </form>

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div className="space-y-1">
              <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">Analysis Result</span>
              <div className="flex items-center gap-3">
                {getVerdictBadge(result.verdict)}
                <span className="text-neutral-400 text-sm font-mono">
                  Confidence: {(result.confidence * 100).toFixed(0)}%
                </span>
                {result.cache_hit && (
                  <span className="text-xs bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded">Cache Hit</span>
                )}
              </div>
            </div>
            <div className="text-right text-xs font-mono text-neutral-400 space-y-1">
              <div>Latency: {result.latency} ms</div>
              <div>Estimated Cost: ${result.cost.toFixed(6)}</div>
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase font-mono text-neutral-500 mb-2">Forensic Reasoning</h3>
            <p className="text-neutral-200 text-sm leading-relaxed bg-neutral-950/60 p-4 rounded-lg border border-neutral-800/80">
              {result.reasoning}
            </p>
          </div>

          {result.details && (
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-800/80 space-y-2">
                <span className="text-cyan-400 font-semibold uppercase">RDAP Details</span>
                <div>Domain: <span className="text-neutral-300">{result.details.domain}</span></div>
                <div>Age: <span className="text-neutral-300">{result.details.rdap?.age_days !== undefined ? `${result.details.rdap.age_days} days` : 'N/A'}</span></div>
                <div>Registrar: <span className="text-neutral-300">{result.details.rdap?.registrar || 'N/A'}</span></div>
                <div>Privacy Masked: <span className="text-neutral-300">{result.details.rdap?.privacy_redacted ? 'Yes' : 'No'}</span></div>
              </div>

              <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-800/80 space-y-2">
                <span className="text-cyan-400 font-semibold uppercase">Network & Geo Details</span>
                <div>Resolved IPs: <span className="text-neutral-300">{result.details.resolved_ips.join(', ') || 'N/A'}</span></div>
                <div>ASN: <span className="text-neutral-300">{result.details.geo?.asn || 'N/A'} ({result.details.geo?.asn_org || 'N/A'})</span></div>
                <div>Country: <span className="text-neutral-300">{result.details.geo?.country || 'N/A'}</span></div>
                <div>CDN Detected: <span className="text-neutral-300">{result.details.cdn_detected ? 'Yes (Reverse Proxy)' : 'No'}</span></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
