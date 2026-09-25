import type { Db } from "../db";
import { ApiError } from "../http";

/** Fixed-window counter in the database, so limits hold across restarts and across every
 * server instance. One atomic upsert: concurrent requests can't both slip under the limit. */
export async function hitRateLimit(db: Db, key: string, limit: number, windowMs: number, now = Date.now()) {
  const row = await db.one<{ window_start: number; count: number }>(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, $2, 1)
     ON CONFLICT (key) DO UPDATE SET
       window_start = CASE WHEN rate_limits.window_start <= $3 THEN EXCLUDED.window_start ELSE rate_limits.window_start END,
       count        = CASE WHEN rate_limits.window_start <= $3 THEN 1 ELSE rate_limits.count + 1 END
     RETURNING window_start, count`,
    [key, now, now - windowMs]
  );
  if (row!.count > limit) return { allowed: false, retryAfterMs: row!.window_start + windowMs - now };
  return { allowed: true, retryAfterMs: 0 };
}

export async function enforceRateLimit(db: Db, key: string, limit: number, windowMs: number, message = "Too many attempts.") {
  const r = await hitRateLimit(db, key, limit, windowMs);
  if (!r.allowed) {
    const minutes = Math.max(1, Math.ceil(r.retryAfterMs / 60000));
    throw new ApiError(429, `${message} Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, "rate_limited", {
      retryAfterSeconds: Math.ceil(r.retryAfterMs / 1000),
    });
  }
}

export async function clearRateLimit(db: Db, key: string) {
  await db.query("DELETE FROM rate_limits WHERE key = $1", [key]);
}

export async function pruneRateLimits(db: Db, olderThanMs = 24 * 60 * 60 * 1000) {
  await db.query("DELETE FROM rate_limits WHERE window_start < $1", [Date.now() - olderThanMs]);
}
