-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Request Logs: Stores every analysis request
CREATE TABLE IF NOT EXISTS request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    verdict TEXT NOT NULL CHECK (verdict IN ('benign', 'suspicious', 'malicious')),
    confidence DOUBLE PRECISION NOT NULL,
    reasoning TEXT NOT NULL,
    latency_ms INTEGER NOT NULL,
    cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
    model TEXT NOT NULL,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_domain ON request_logs(domain);

-- 2. Tool Cache: Generic cache for individual tool outputs (RDAP, GeoLite2)
CREATE TABLE IF NOT EXISTS tool_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_name TEXT NOT NULL,
    cache_key TEXT NOT NULL,
    payload JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tool_cache_tool_key UNIQUE (tool_name, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_tool_cache_lookup ON tool_cache(tool_name, cache_key);
CREATE INDEX IF NOT EXISTS idx_tool_cache_expires_at ON tool_cache(expires_at);

-- 3. Verdict Cache: Normalized URL full response cache
CREATE TABLE IF NOT EXISTS verdict_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    normalized_url TEXT NOT NULL UNIQUE,
    payload JSONB NOT NULL,
    is_demo_fixture BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verdict_cache_lookup ON verdict_cache(normalized_url);
CREATE INDEX IF NOT EXISTS idx_verdict_cache_expires_at ON verdict_cache(expires_at);

-- 4. Eval Runs & Results: Summaries and records of evaluation harness runs
CREATE TABLE IF NOT EXISTS eval_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_samples INTEGER NOT NULL,
    tpr DOUBLE PRECISION NOT NULL,
    fpr DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION NOT NULL,
    latency_p50_ms DOUBLE PRECISION NOT NULL,
    latency_p95_ms DOUBLE PRECISION NOT NULL,
    estimated_cost_per_10k DOUBLE PRECISION NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS eval_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES eval_runs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    ground_truth TEXT NOT NULL CHECK (ground_truth IN ('benign', 'malicious')),
    predicted_verdict TEXT NOT NULL CHECK (predicted_verdict IN ('benign', 'suspicious', 'malicious')),
    confidence DOUBLE PRECISION NOT NULL,
    latency_ms INTEGER NOT NULL,
    cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eval_results_run_id ON eval_results(run_id);
