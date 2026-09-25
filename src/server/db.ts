import path from "node:path";
import { randomBytes } from "node:crypto";
import { MIGRATIONS } from "./migrations";
import { seedAndReport } from "./seed";

/**
 * The one database interface the server uses. Production talks to Supabase Postgres over
 * DATABASE_URL; local development, unit tests and the e2e harness use an embedded Postgres
 * (PGlite) so nothing needs installing. Both speak the same SQL with $1-style parameters.
 */
export interface Db {
  /** Runs one statement and returns its rows. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** First row or null. */
  one<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
  /** Runs one or more parameterless statements (schema migrations). */
  exec(sql: string): Promise<void>;
  /** Runs fn in a transaction: committed if it resolves, rolled back if it throws. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// Timestamps are stored as BIGINT milliseconds; both drivers would otherwise hand them back
// as strings/BigInts. They stay far below 2^53, so plain numbers are exact.
const INT8 = 20;
const toNumber = (v: string) => Number(v);

// ─── Supabase / any Postgres (postgres.js) ──────────────────────────────────

async function openPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    // Supabase's transaction pooler (port 6543, the right choice on Vercel) doesn't support
    // prepared statements.
    prepare: false,
    max: Number(process.env.DATABASE_POOL_MAX) || 5,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require",
    types: { int8: { to: INT8, from: [INT8], serialize: (x: number) => String(x), parse: toNumber } },
    onnotice: () => {},
  });
  type Runner = { unsafe: (q: string, p?: unknown[]) => Promise<unknown[]> };
  const wrap = (run: Runner, begin?: <T>(fn: (t: Runner) => Promise<T>) => Promise<T>): Db => {
    const query = async <T,>(q: string, params: unknown[] = []) => (await run.unsafe(q, params as never[])) as T[];
    return {
      query,
      one: async (q, params) => ((await query(q, params))[0] as never) ?? null,
      exec: async (q) => {
        await run.unsafe(q);
      },
      tx: (fn) => {
        if (!begin) throw new Error("Nested transactions are not supported.");
        return begin((t) => fn(wrap(t)));
      },
      close: () => sql.end({ timeout: 5 }),
    };
  };
  return wrap(sql as unknown as Runner, (fn) => sql.begin((t) => fn(t as unknown as Runner)) as never);
}

/** Shows where a connection string points without revealing its password. */
export function redactDatabaseUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "****";
    return u.toString();
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

// ─── Embedded Postgres (PGlite) ─────────────────────────────────────────────

/** Opens an embedded Postgres: in memory for tests, or persisted in a folder. */
export async function openPglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(dataDir, { parsers: { [INT8]: toNumber } });
  await pg.waitReady;
  type Runner = { query: (q: string, p?: unknown[]) => Promise<{ rows: unknown[] }>; exec: (q: string) => Promise<unknown> };
  const wrap = (run: Runner, inTx: boolean): Db => {
    const query = async <T,>(q: string, params: unknown[] = []) => (await run.query(q, params)).rows as T[];
    return {
      query,
      one: async (q, params) => ((await query(q, params))[0] as never) ?? null,
      exec: async (q) => {
        await run.exec(q);
      },
      tx: (fn) => {
        if (inTx) throw new Error("Nested transactions are not supported.");
        return pg.transaction((t) => fn(wrap(t as unknown as Runner, true)));
      },
      close: () => pg.close(),
    };
  };
  return wrap(pg as unknown as Runner, false);
}

// ─── Process-wide connection ────────────────────────────────────────────────

const DEFAULT_PGLITE_DIR = path.join(process.cwd(), "data", "pglite");

/** Opens whichever database this environment is configured for and brings its schema up to date. */
export async function openDatabase(): Promise<Db> {
  const url = process.env.DATABASE_URL?.trim();
  let db: Db;
  if (url) {
    db = await openPostgres(url);
  } else if (process.env.VERCEL || process.env.INSIGHTCHART_REQUIRE_DATABASE_URL === "1") {
    throw new Error(
      "DATABASE_URL is not set. Add your Supabase connection string (Project Settings → Database → Connection string → Transaction pooler) to the environment."
    );
  } else {
    db = await openPglite(process.env.INSIGHTCHART_PGLITE_DIR || DEFAULT_PGLITE_DIR);
  }
  await runMigrations(db);
  return db;
}

// One connection (pool) per server process, reused across requests and dev hot reloads.
const globalForDb = globalThis as unknown as { __insightchartDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__insightchartDb) {
    globalForDb.__insightchartDb = openDatabase()
      .then(async (db) => {
        await seedAndReport(db);
        return db;
      })
      .catch((err) => {
        // Don't cache a failed connection — the next request tries again.
        globalForDb.__insightchartDb = undefined;
        throw err;
      });
  }
  return globalForDb.__insightchartDb;
}

/** Test-only: swap the process-wide database. */
export function setDbForTests(db: Db | undefined) {
  globalForDb.__insightchartDb = db ? Promise.resolve(db) : undefined;
}

// ─── Schema ─────────────────────────────────────────────────────────────────

/** Applies pending migrations in order, each in its own transaction. An advisory lock
 * makes concurrent cold starts (several serverless instances at once) take turns. */
export async function runMigrations(db: Db): Promise<number[]> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at BIGINT NOT NULL)`);
  const applied = new Set((await db.query<{ version: number }>("SELECT version FROM schema_migrations")).map((r) => r.version));
  if (MIGRATIONS.every((m) => applied.has(m.version))) {
    await ensureMeta(db);
    return [];
  }
  const done: number[] = [];
  for (const m of [...MIGRATIONS].sort((a, b) => a.version - b.version)) {
    await db.tx(async (t) => {
      await t.query("SELECT pg_advisory_xact_lock(724091)");
      if (await t.one("SELECT 1 FROM schema_migrations WHERE version = $1", [m.version])) return;
      try {
        await t.exec(m.sql);
      } catch (err) {
        throw new Error(`Migration ${m.version} (${m.name}) failed and was rolled back: ${(err as Error).message}`);
      }
      await t.query("INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)", [m.version, m.name, Date.now()]);
      done.push(m.version);
    });
  }
  await ensureMeta(db);
  return done;
}

async function ensureMeta(db: Db) {
  // Per-installation pepper for OTP hashes, so a leaked otp_challenges table alone
  // can't be brute-forced against the 10^6 code space.
  await db.query("INSERT INTO app_meta (key, value) VALUES ('otp_pepper', $1) ON CONFLICT (key) DO NOTHING", [randomBytes(32).toString("hex")]);
}

const metaCache = new Map<string, string>();

export async function getMeta(db: Db, key: string): Promise<string | null> {
  const cached = metaCache.get(key);
  if (cached) return cached;
  const row = await db.one<{ value: string }>("SELECT value FROM app_meta WHERE key = $1", [key]);
  if (row) metaCache.set(key, row.value);
  return row?.value ?? null;
}

/** Test-only: forget cached app_meta values when the database is swapped. */
export function clearMetaCache() {
  metaCache.clear();
}

export async function audit(db: Db, userId: number | null, action: string, detail?: Record<string, unknown>) {
  await db.query("INSERT INTO audit_log (user_id, action, detail, created_at) VALUES ($1, $2, $3, $4)", [
    userId,
    action,
    detail ? JSON.stringify(detail) : null,
    Date.now(),
  ]);
}
