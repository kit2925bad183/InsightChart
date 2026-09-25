// `npm run db:import-sqlite` — one-time copy of the old local SQLite database
// (./data/insightchart.db) into the database DATABASE_URL points at (your Supabase project).
//
// Copies accounts (with their existing password hashes, so passwords keep working), the
// shared dataset and the audit history. Sessions, pending OTP codes and rate-limit counters
// are not copied — everyone simply signs in again.
//
// Refuses to run if the target already has accounts, unless you pass --replace, which
// first deletes everything in the target.
import { loadEnvConfig } from "@next/env";
import { existsSync } from "node:fs";
import path from "node:path";

loadEnvConfig(process.cwd());

type Row = Record<string, unknown>;

async function main() {
  const replace = process.argv.includes("--replace");
  const file = process.env.INSIGHTCHART_DB_PATH || path.join(process.cwd(), "data", "insightchart.db");
  if (!existsSync(file)) throw new Error(`No SQLite database at ${file} — nothing to import.`);
  if (!process.env.DATABASE_URL?.trim()) throw new Error("Set DATABASE_URL (your Supabase connection string) in .env.local first.");

  const { DatabaseSync } = await import("node:sqlite");
  const src = new DatabaseSync(file, { readOnly: true });
  const all = (sql: string) => src.prepare(sql).all() as Row[];
  const users = all("SELECT * FROM users ORDER BY id");
  const datasets = all("SELECT * FROM datasets");
  const auditLog = all("SELECT * FROM audit_log ORDER BY id");
  src.close();

  const { openDatabase, redactDatabaseUrl: redact } = await import("../src/server/db");
  console.log(`From: ${file}`);
  console.log(`To:   ${redact(process.env.DATABASE_URL!)}`);
  const db = await openDatabase();

  const existing = (await db.one<{ n: number }>("SELECT COUNT(*) AS n FROM users"))!.n;
  if (existing && !replace) {
    throw new Error(
      `The target database already has ${existing} account(s). Nothing was changed. Run with --replace to wipe the target and import, e.g.\n  npm run db:import-sqlite -- --replace`
    );
  }

  await db.tx(async (t) => {
    if (replace) await t.exec("TRUNCATE users, sessions, otp_challenges, rate_limits, datasets, audit_log RESTART IDENTITY CASCADE");
    for (const u of users) {
      await t.query(
        `INSERT INTO users (id, username, display_name, role, email, email_verified, password_hash, must_change_password, is_active, created_by, created_at, updated_at, password_changed_at)
         OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [u.id, u.username, u.display_name, u.role, u.email, u.email_verified, u.password_hash, u.must_change_password, u.is_active, u.created_by, u.created_at, u.updated_at, u.password_changed_at]
      );
    }
    for (const d of datasets) {
      await t.query("INSERT INTO datasets (id, source_json, config_json, source_version, updated_by, updated_at) VALUES ($1, $2, $3, $4, $5, $6)", [
        d.id,
        d.source_json,
        d.config_json,
        d.source_version,
        d.updated_by,
        d.updated_at,
      ]);
    }
    for (const a of auditLog) {
      await t.query("INSERT INTO audit_log (user_id, action, detail, created_at) VALUES ($1, $2, $3, $4)", [a.user_id, a.action, a.detail, a.created_at]);
    }
    // New accounts must continue numbering after the imported ids.
    await t.query("SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT MAX(id) FROM users), 1))");
    await t.query("INSERT INTO audit_log (user_id, action, detail, created_at) VALUES (NULL, 'import.sqlite', $1, $2)", [
      JSON.stringify({ users: users.length, datasets: datasets.length, auditEntries: auditLog.length }),
      Date.now(),
    ]);
  });

  console.log(`✔ Imported ${users.length} account(s): ${users.map((u) => u.username).join(", ")}`);
  console.log(`✔ Imported ${datasets.length ? "the shared dataset" : "no dataset (none saved)"} and ${auditLog.length} audit entries.`);
  await db.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
