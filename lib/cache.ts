import { queryDb } from './db';
import { AnalyzeResponse } from './types';
import fs from 'fs';
import path from 'path';

const memoryCache = new Map<string, { payload: any; expiresAt: number }>();

export async function getFromCache<T>(key: string): Promise<T | null> {
  const now = Date.now();
  
  const mem = memoryCache.get(key);
  if (mem) {
    if (mem.expiresAt > now) {
      return mem.payload as T;
    }
    memoryCache.delete(key);
  }

  try {
    if (key.startsWith('verdict:')) {
      const normalizedUrl = key.replace('verdict:', '');
      const rows = await queryDb(
        `SELECT payload FROM verdict_cache WHERE normalized_url = $1 AND expires_at > NOW() LIMIT 1`,
        [normalizedUrl]
      );
      if (rows.length > 0) {
        return rows[0].payload as T;
      }
    } else {
      const [toolName, ...rest] = key.split(':');
      const cacheKey = rest.join(':');
      const rows = await queryDb(
        `SELECT payload FROM tool_cache WHERE tool_name = $1 AND cache_key = $2 AND expires_at > NOW() LIMIT 1`,
        [toolName, cacheKey]
      );
      if (rows.length > 0) {
        return rows[0].payload as T;
      }
    }
  } catch (err) {
    console.warn(`[Cache] Database cache read fallback for key ${key}`);
  }

  return null;
}

export async function setInCache(key: string, payload: any, ttlSeconds: number): Promise<void> {
  const expiresAtMs = Date.now() + ttlSeconds * 1000;
  memoryCache.set(key, { payload, expiresAt: expiresAtMs });

  try {
    const expiresAtDate = new Date(expiresAtMs);
    if (key.startsWith('verdict:')) {
      const normalizedUrl = key.replace('verdict:', '');
      await queryDb(
        `INSERT INTO verdict_cache (normalized_url, payload, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (normalized_url) 
         DO UPDATE SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at`,
        [normalizedUrl, JSON.stringify(payload), expiresAtDate]
      );
    } else {
      const [toolName, ...rest] = key.split(':');
      const cacheKey = rest.join(':');
      await queryDb(
        `INSERT INTO tool_cache (tool_name, cache_key, payload, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tool_name, cache_key)
         DO UPDATE SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at`,
        [toolName, cacheKey, JSON.stringify(payload), expiresAtDate]
      );
    }
  } catch (err) {
    console.warn(`[Cache] Database cache write fallback for key ${key}`);
  }
}

export function getDemoFixture(normalizedUrl: string): AnalyzeResponse | null {
  try {
    const fixturePath = path.join(process.cwd(), 'data', 'demo-urls.json');
    if (fs.existsSync(fixturePath)) {
      const raw = fs.readFileSync(fixturePath, 'utf-8');
      const fixtures: Record<string, AnalyzeResponse> = JSON.parse(raw);
      if (fixtures[normalizedUrl]) {
        return {
          ...fixtures[normalizedUrl],
          cache_hit: true,
          degraded: 'demo_fixture',
        };
      }
    }
  } catch (err) {
    console.warn('[Cache] Could not load demo fixtures:', err);
  }
  return null;
}
