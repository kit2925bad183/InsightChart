// Supabase exposes every table in "public" through its Data API to anyone holding the
// project's public anon key. The schema must shut that door: these tables hold password
// hashes, sessions and OTP challenges.
import { describe, expect, it } from "vitest";
import { openPglite, runMigrations } from "../db";

describe("Supabase Data API lockdown", () => {
  it("revokes the API roles' access and enables row level security on every table", async () => {
    const db = await openPglite();
    // Recreate what a Supabase project has before our migrations run: the API roles, and
    // default privileges that grant them every new table.
    await db.exec(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      GRANT USAGE ON SCHEMA public TO anon, authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    `);
    await runMigrations(db);
    await db.query("INSERT INTO users (username, display_name, role, password_hash, created_at, updated_at) VALUES ('x', 'X', 'FACULTY', 'hash', 0, 0)");

    const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "SELECT relname, relrowsecurity FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace ORDER BY relname"
    );
    expect(tables.length).toBeGreaterThanOrEqual(8);
    expect(tables.filter((t) => !t.relrowsecurity).map((t) => t.relname)).toEqual([]);

    for (const role of ["anon", "authenticated"]) {
      for (const table of ["users", "sessions", "otp_challenges", "datasets"]) {
        await expect(db.tx(async (t) => {
          await t.exec(`SET LOCAL ROLE ${role}`);
          return t.query(`SELECT * FROM ${table}`);
        })).rejects.toThrow(/permission denied/);
      }
    }
    // The server's own connection is unaffected.
    expect(await db.query("SELECT username FROM users")).toEqual([{ username: "x" }]);
    await db.close();
    // Boots its own Postgres, which is slower while other test files run in parallel.
  }, 60_000);
});
