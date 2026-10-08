# Aperio — Cloaked Phishing Detection Agent

Aperio is an infrastructure-first phishing detection agent designed to identify cloaked phishing attacks by inspecting domain, registration, network, and hosting infrastructure—without ever fetching, rendering, or executing page content.

## Architectural Principles & Strict Guarantees
- **Zero Content Fetching:** Never fetch, render, screenshot, or proxy target HTML/DOM.
- **Infrastructure Signals Only:** Operates purely on RDAP registration history and DNS + GeoLite2 network ASN/Geo metadata.
- **Deterministic Tools:** Tools are pure TypeScript without nested LLM logic.
- **Fail-Safe & Resilient:** Backed by multi-level caching (verdict, RDAP, GeoIP) and demo fixtures to withstand Gemini rate limits or outages.

## Project Structure
- `app/`: Next.js App Router (Checker UI, Live History, Evaluation Dashboard, and `/api` routes)
- `lib/`: Orchestrator, Gemini tool-calling engine, caching, rate limiting, and PostgreSQL client
- `tools/`: Deterministic forensic tools (`rdap.ts`, `geolite2.ts`)
- `data/`: Sample fixtures, demo URLs, and labeled benchmark datasets
- `eval/`: Offline Python evaluation harness (`harness.py`)
- `supabase/migrations/`: Database schema definitions
