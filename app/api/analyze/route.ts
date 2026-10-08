import { NextRequest, NextResponse } from 'next/server';
import { orchestrateAnalysis } from '@/lib/orchestrator';
import { AnalyzeRequestSchema } from '@/lib/types';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bypassCache = searchParams.get('fresh') === '1';

    const body = await req.json();
    const parsed = AnalyzeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid URL input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await orchestrateAnalysis(parsed.data.url, { bypassCache });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API /analyze error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error during analysis' },
      { status: 500 }
    );
  }
}
