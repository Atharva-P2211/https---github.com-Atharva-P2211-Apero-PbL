'use client';

import React, { useEffect, useState } from 'react';

interface EvalRun {
  timestamp: string;
  total_samples: number;
  tpr: number;
  fpr: number;
  accuracy: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  estimated_cost_per_10k: number;
}

export default function EvalDashboardPage() {
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/eval')
      .then((res) => res.json())
      .then((data) => {
        if (data.runs) setRuns(data.runs);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const latest = runs[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Evaluation Benchmark Dashboard</h1>
        <p className="text-neutral-400 text-sm">
          Metrics computed offline by the evaluation harness against labeled benchmark datasets (PhishTank & Tranco).
        </p>
      </div>

      {loading ? (
        <div className="text-neutral-400 text-sm">Loading evaluation metrics...</div>
      ) : !latest ? (
        <div className="p-8 border border-neutral-800 rounded-xl bg-neutral-900/50 text-center text-neutral-500 text-sm">
          No evaluation runs found. Run `python eval/harness.py` to generate benchmark metrics.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
              <div className="text-xs font-mono text-neutral-500 uppercase">True Positive Rate (TPR)</div>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
                {(latest.tpr * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-neutral-500 mt-1">Malicious lure detection</div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
              <div className="text-xs font-mono text-neutral-500 uppercase">False Positive Rate (FPR)</div>
              <div className="text-2xl font-bold font-mono text-cyan-400 mt-2">
                {(latest.fpr * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-neutral-500 mt-1">Benign domain false flags</div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
              <div className="text-xs font-mono text-neutral-500 uppercase">Latency Percentiles</div>
              <div className="text-xl font-bold font-mono text-neutral-200 mt-2">
                {latest.latency_p50_ms} <span className="text-xs text-neutral-500">p50</span> / {latest.latency_p95_ms} <span className="text-xs text-neutral-500">p95 ms</span>
              </div>
              <div className="text-[11px] text-neutral-500 mt-1">End-to-end wall time</div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
              <div className="text-xs font-mono text-neutral-500 uppercase">Est. Cost / 10k URLs</div>
              <div className="text-2xl font-bold font-mono text-yellow-400 mt-2">
                ${latest.estimated_cost_per_10k.toFixed(2)}
              </div>
              <div className="text-[11px] text-neutral-500 mt-1">Gemini 2.5 Flash token rates</div>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl space-y-4">
            <h3 className="text-sm font-semibold text-neutral-300">Run Metadata</h3>
            <div className="text-xs font-mono text-neutral-400 grid grid-cols-2 gap-2">
              <div>Sample Size: <span className="text-neutral-200">{latest.total_samples} labeled URLs</span></div>
              <div>Accuracy: <span className="text-neutral-200">{(latest.accuracy * 100).toFixed(1)}%</span></div>
              <div>Evaluation Date: <span className="text-neutral-200">{new Date(latest.timestamp).toLocaleString()}</span></div>
              <div>Orchestrator Model: <span className="text-neutral-200">gemini-2.5-flash</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
