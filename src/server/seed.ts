import type { Db } from "./db";
import { hashPassword, validateInitialPassword } from "./auth/passwords";
import type { Role } from "@/lib/auth/permissions";

/** Any env-like map (process.env or a plain object in tests). */
type Env = Record<string, string | undefined>;

interface InitialAccount {
  username: string;
  displayName: string;
  role: Role;
  envVar: string;
}

export const INITIAL_ACCOUNTS: InitialAccount[] = [
  { username: "createradmin123", displayName: "Creator Admin", role: "CREATOR_ADMIN", envVar: "CREATOR_ADMIN_INITIAL_PASSWORD" },
  { username: "admin123", displayName: "Administrator", role: "ADMINISTRATOR", envVar: "ADMINISTRATOR_INITIAL_PASSWORD" },
];

export interface SeedResult {
  created: string[];
  skippedExisting: string[];
  missingPassword: string[];
}

/** Creates the two initial accounts if (and only if) they don't exist yet. Existing
 * accounts are never touched, so re-running this can't reset anyone's password. The
 * password comes only from the environment and is never logged. */
export async function seedInitialAccounts(db: Db, env: Env = process.env): Promise<SeedResult> {
  const result: SeedResult = { created: [], skippedExisting: [], missingPassword: [] };
  for (const acct of INITIAL_ACCOUNTS) {
    const exists =
      acct.role === "CREATOR_ADMIN"
        ? await db.one("SELECT 1 FROM users WHERE role = 'CREATOR_ADMIN' OR lower(username) = lower($1)", [acct.username])
        : await db.one("SELECT 1 FROM users WHERE lower(username) = lower($1)", [acct.username]);
    if (exists) {
      result.skippedExisting.push(acct.username);
      continue;
    }
    const password = env[acct.envVar];
    if (!password || validateInitialPassword(password)) {
      result.missingPassword.push(acct.username);
      continue;
    }
    const now = Date.now();
    // Several serverless instances may start at once: whoever inserts first wins, the
    // others see the conflict and leave the account alone.
    const inserted = await db.query(
      `INSERT INTO users (username, display_name, role, password_hash, must_change_password, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 1, $5, $6) ON CONFLICT DO NOTHING RETURNING id`,
      [acct.username, acct.displayName, acct.role, await hashPassword(password), now, now]
    );
    if (inserted.length) result.created.push(acct.username);
    else result.skippedExisting.push(acct.username);
  }
  return result;
}

const warned = new Set<string>();

export async function seedAndReport(db: Db) {
  const r = await seedInitialAccounts(db);
  for (const u of r.created) console.info(`[insightchart] Created initial account "${u}" (password change required at first login).`);
  for (const u of r.missingPassword) {
    if (warned.has(u)) continue;
    warned.add(u);
    const acct = INITIAL_ACCOUNTS.find((a) => a.username === u)!;
    console.warn(`[insightchart] Initial account "${u}" not created: set ${acct.envVar} (at least 8 characters) in .env.local and restart.`);
  }
  return r;
}
