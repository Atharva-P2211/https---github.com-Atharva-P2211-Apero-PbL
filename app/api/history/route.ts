import { NextResponse } from 'next/server';
import { queryDb } from '@/lib/db';

export async function GET() {
  try {
    const rows = await queryDb(
      `SELECT id, url, domain, verdict, confidence, reasoning, latency_ms, cost_usd, cache_hit, created_at 
       FROM request_logs 
       ORDER BY created_at DESC 
       LIMIT 50`
    );

    return NextResponse.json({ history: rows });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
