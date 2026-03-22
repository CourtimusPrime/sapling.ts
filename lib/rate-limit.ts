/**
 * Simple in-memory sliding window rate limiter.
 * Tracks requests per IP with a configurable window and max requests.
 * Entries are cleaned up on access to prevent memory leaks.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 20; // 20 requests per minute

function cleanup(entry: RateLimitEntry, now: number): void {
  const cutoff = now - WINDOW_MS;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
}

export function rateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let entry = store.get(ip);

  if (!entry) {
    entry = { timestamps: [] };
    store.set(ip, entry);
  }

  cleanup(entry, now);

  if (entry.timestamps.length >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  entry.timestamps.push(now);
  return { allowed: true, remaining: MAX_REQUESTS - entry.timestamps.length };
}

// Periodically clean up stale entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of store) {
    cleanup(entry, now);
    if (entry.timestamps.length === 0) {
      store.delete(ip);
    }
  }
}, 5 * 60_000); // Every 5 minutes
