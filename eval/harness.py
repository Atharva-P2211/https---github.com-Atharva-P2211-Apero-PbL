"""
Aperio Evaluation Harness (CLI)
Iterates over labeled-urls.csv, queries the live POST /api/analyze endpoint,
computes TPR, FPR, latency percentiles, and cost estimates.
"""

import os
import sys
import time
import json
import argparse
import requests
import pandas as pd
from datetime import datetime

ANALYZE_ENDPOINT = os.getenv("APERIO_ENDPOINT", "http://localhost:3000/api/analyze")
API_KEY = os.getenv("ANALYZE_API_KEY", "dev_secret_analyze_key")

def run_evaluation(dataset_path: str, output_dir: str, limit: int = None, delay: float = 1.0):
    print(f"[*] Starting Aperio evaluation on: {dataset_path}")
    print(f"[*] Targeting endpoint: {ANALYZE_ENDPOINT}")

    df = pd.read_csv(dataset_path)
    if limit:
        df = df.head(limit)

    results = []
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
    }

    for idx, row in df.iterrows():
        target_url = row["url"]
        ground_truth = row["label"]
        print(f"[{idx+1}/{len(df)}] Evaluating {target_url} (True: {ground_truth})...")

        req_start = time.time()
        try:
            resp = requests.post(
                f"{ANALYZE_ENDPOINT}?fresh=1",
                headers=headers,
                json={"url": target_url},
                timeout=35
            )
            wall_time_ms = int((time.time() - req_start) * 1000)

            if resp.status_code == 200:
                payload = resp.json()
                pred_verdict = payload.get("verdict", "unknown")
                confidence = payload.get("confidence", 0.0)
                cost = payload.get("cost", 0.0)
                reported_lat = payload.get("latency", wall_time_ms)
            else:
                pred_verdict = "error"
                confidence = 0.0
                cost = 0.0
                reported_lat = wall_time_ms
                print(f"    [-] Error HTTP {resp.status_code}: {resp.text[:100]}")
        except Exception as e:
            wall_time_ms = int((time.time() - req_start) * 1000)
            pred_verdict = "error"
            confidence = 0.0
            cost = 0.0
            reported_lat = wall_time_ms
            print(f"    [-] Exception: {e}")

        results.append({
            "url": target_url,
            "ground_truth": ground_truth,
            "predicted": pred_verdict,
            "confidence": confidence,
            "latency_ms": reported_lat,
            "wall_latency_ms": wall_time_ms,
            "cost_usd": cost,
        })

        time.sleep(delay)

    res_df = pd.DataFrame(results)

    malicious_subset = res_df[res_df["ground_truth"] == "malicious"]
    benign_subset = res_df[res_df["ground_truth"] == "benign"]

    tp = len(malicious_subset[malicious_subset["predicted"] == "malicious"])
    fn = len(malicious_subset[malicious_subset["predicted"] != "malicious"])
    fp = len(benign_subset[benign_subset["predicted"].isin(["malicious", "suspicious"])])
    tn = len(benign_subset[~benign_subset["predicted"].isin(["malicious", "suspicious"])])

    tpr = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    accuracy = (tp + tn) / len(res_df) if len(res_df) > 0 else 0.0

    p50_lat = float(res_df["latency_ms"].median()) if not res_df.empty else 0.0
    p95_lat = float(res_df["latency_ms"].quantile(0.95)) if not res_df.empty else 0.0

    mean_cost = float(res_df["cost_usd"].mean()) if not res_df.empty else 0.0
    cost_per_10k = mean_cost * 10000

    summary = {
        "timestamp": datetime.utcnow().isoformat(),
        "total_samples": len(res_df),
        "tpr": round(tpr, 4),
        "fpr": round(fpr, 4),
        "accuracy": round(accuracy, 4),
        "latency_p50_ms": round(p50_lat, 2),
        "latency_p95_ms": round(p95_lat, 2),
        "mean_cost_usd": round(mean_cost, 6),
        "estimated_cost_per_10k": round(cost_per_10k, 4),
    }

    os.makedirs(output_dir, exist_ok=True)
    ts_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    run_file = os.path.join(output_dir, f"run_{ts_str}.json")
    summary_file = os.path.join(output_dir, "latest_summary.json")

    with open(run_file, "w") as f:
        json.dump({"summary": summary, "results": results}, f, indent=2)

    with open(summary_file, "w") as f:
        json.dump(summary, f, indent=2)

    print("\n================ EVALUATION SUMMARY ================")
    print(f"Total Samples: {summary['total_samples']}")
    print(f"TPR (True Positive Rate): {summary['tpr'] * 100:.2f}%")
    print(f"FPR (False Positive Rate): {summary['fpr'] * 100:.2f}%")
    print(f"Latency p50: {summary['latency_p50_ms']} ms | p95: {summary['latency_p95_ms']} ms")
    print(f"Estimated Cost per 10k: ${summary['estimated_cost_per_10k']:.4f}")
    print(f"Results saved to: {run_file} and {summary_file}")
    print("====================================================\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Aperio Evaluation Harness")
    parser.add_argument("--dataset", default="data/labeled-urls.csv", help="Path to labeled URLs CSV")
    parser.add_argument("--output", default="eval/results", help="Directory for output results")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of samples")
    parser.add_argument("--delay", type=float, default=1.0, help="Delay between requests in seconds")
    args = parser.parse_args()

    run_evaluation(args.dataset, args.output, args.limit, args.delay)
