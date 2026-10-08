'use client';

import React, { useEffect, useState } from 'react';

interface HistoryRecord {
  id: string;
  url: string;
  domain: string;
  verdict: 'benign' | 'suspicious' | 'malicious';
  confidence: number;
  reasoning: string;
  latency_ms: number;
  cost_usd: number;
  created_at: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/history')
      .then((res) => res.json())
      .then((data) => {
        if (data.history) setHistory(data.history);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const getBadge = (verdict: string) => {
    switch (verdict) {
      case 'malicious':
        return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/40 rounded text-xs">Malicious</span>;
      case 'suspicious':
        return <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 rounded text-xs">Suspicious</span>;
      default:
        return <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-xs">Benign</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Live Analysis History</h1>
        <p className="text-neutral-400 text-sm">
          Recent inspection logs recorded by the Aperio orchestrator.
        </p>
      </div>

      {loading ? (
        <div className="text-neutral-400 text-sm">Loading historical logs...</div>
      ) : history.length === 0 ? (
        <div className="p-8 border border-neutral-800 rounded-xl bg-neutral-900/50 text-center text-neutral-500 text-sm">
          No live analysis requests recorded yet. Try running an inspection from the Checker.
        </div>
      ) : (
        <div className="overflow-x-auto border border-neutral-800 rounded-xl">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-neutral-900 text-neutral-400 border-b border-neutral-800">
              <tr>
                <th className="p-3">Domain / URL</th>
                <th className="p-3">Verdict</th>
                <th className="p-3">Confidence</th>
                <th className="p-3">Latency</th>
                <th className="p-3">Est. Cost</th>
                <th className="p-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 bg-neutral-950/80">
              {history.map((row) => (
                <tr key={row.id} className="hover:bg-neutral-900/40 transition">
                  <td className="p-3 max-w-xs truncate text-neutral-200" title={row.url}>
                    <div className="font-semibold text-neutral-100">{row.domain}</div>
                    <div className="text-neutral-500 text-[10px] truncate">{row.url}</div>
                  </td>
                  <td className="p-3">{getBadge(row.verdict)}</td>
                  <td className="p-3 text-neutral-400">{(row.confidence * 100).toFixed(0)}%</td>
                  <td className="p-3 text-neutral-400">{row.latency_ms} ms</td>
                  <td className="p-3 text-neutral-400">${Number(row.cost_usd).toFixed(6)}</td>
                  <td className="p-3 text-neutral-500">{new Date(row.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
