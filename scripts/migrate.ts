// `npm run db:migrate` — creates/updates the database schema and seeds the two initial
// accounts if they don't exist yet. Uses DATABASE_URL (your Supabase database) when set,
// otherwise the local embedded database in ./data/pglite. The server also does this on its
// first request; run it up front after setting DATABASE_URL to check the connection.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { openDatabase, redactDatabaseUrl: redact } = await import("../src/server/db");
  const { seedInitialAccounts, INITIAL_ACCOUNTS } = await import("../src/server/seed");

  const url = process.env.DATABASE_URL?.trim();
  console.log(url ? `Database: ${redact(url)}` : "Database: local embedded Postgres (./data/pglite) — DATABASE_URL is not set");
  const db = await openDatabase();
  const versions = await db.query<{ version: number; name: string }>("SELECT version, name FROM schema_migrations ORDER BY version");
  console.log(`Schema at v${versions.at(-1)?.version ?? 0} (${versions.map((v) => v.name).join(", ")})`);

  const r = await seedInitialAccounts(db);
  for (const u of r.created) console.log(`✔ Created initial account "${u}" — must verify email and change password at first sign-in.`);
  for (const u of r.skippedExisting) console.log(`• Account "${u}" already exists — left unchanged.`);
  for (const u of r.missingPassword) {
    const envVar = INITIAL_ACCOUNTS.find((a) => a.username === u)!.envVar;
    console.log(`✘ Account "${u}" NOT created: set ${envVar} (min 8 characters), then run this again.`);
  }
  await db.close();
  if (r.missingPassword.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
