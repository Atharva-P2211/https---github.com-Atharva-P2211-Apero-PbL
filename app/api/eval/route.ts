import { NextResponse } from 'next/server';
import { queryDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const dbRuns = await queryDb(
      `SELECT * FROM eval_runs ORDER BY run_timestamp DESC LIMIT 10`
    );

    if (dbRuns.length > 0) {
      return NextResponse.json({ runs: dbRuns });
    }

    const summaryPath = path.join(process.cwd(), 'eval', 'results', 'latest_summary.json');
    if (fs.existsSync(summaryPath)) {
      const data = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      return NextResponse.json({ runs: [data] });
    }

    return NextResponse.json({ runs: [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch eval results' },
      { status: 500 }
    );
  }
}
