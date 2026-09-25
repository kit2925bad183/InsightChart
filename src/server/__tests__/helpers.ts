import bcrypt from "bcryptjs";
import { clearMetaCache, openPglite, runMigrations, setDbForTests, type Db } from "../db";
import { setMailTransportForTests, type MailMessage } from "../email/mailer";
import { login } from "../auth/service";
import { SESSION_COOKIE } from "../auth/sessions";
import type { Role } from "@/lib/auth/permissions";

// One in-memory Postgres per test file (starting one takes ~a second); every test gets it
// back empty.
let shared: Promise<Db> | null = null;

export async function freshDb(): Promise<Db> {
  shared ??= openPglite().then(async (db) => {
    await runMigrations(db);
    return db;
  });
  const db = await shared;
  await db.exec("TRUNCATE users, sessions, otp_challenges, rate_limits, datasets, audit_log, app_meta RESTART IDENTITY CASCADE");
  clearMetaCache();
  await runMigrations(db); // re-creates the OTP pepper
  setDbForTests(db);
  return db;
}

export async function addUser(
  db: Db,
  u: { username: string; role: Role; password: string; email?: string | null; verified?: boolean; mustChange?: boolean; active?: boolean; displayName?: string }
): Promise<number> {
  const now = Date.now();
  const row = await db.one<{ id: number }>(
    `INSERT INTO users (username, display_name, role, email, email_verified, password_hash, must_change_password, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      u.username,
      u.displayName ?? u.username,
      u.role,
      u.email ?? null,
      u.verified ? 1 : 0,
      // Low cost keeps tests fast; verification works with any cost factor.
      bcrypt.hashSync(u.password, 4),
      u.mustChange ? 1 : 0,
      u.active === false ? 0 : 1,
      now,
      now,
    ]
  );
  return row!.id;
}

/** Routes mail to an array instead of SMTP. */
export function captureMail(): MailMessage[] {
  const sent: MailMessage[] = [];
  setMailTransportForTests({
    async send(m) {
      sent.push(m);
    },
  });
  return sent;
}

export function codeFrom(msg: MailMessage | undefined): string {
  const m = /Your code: (\d{6})/.exec(msg?.text ?? "");
  if (!m) throw new Error("No OTP in email");
  return m[1];
}

let ipCounter = 0;
/** Signs in through the real service and returns a Cookie header value. */
export async function cookieFor(db: Db, identifier: string, password: string): Promise<string> {
  const r = await login(db, { identifier, password }, { ip: `10.0.0.${++ipCounter % 250}` });
  return `${SESSION_COOKIE}=${r.token}`;
}

export function request(method: string, path: string, opts: { cookie?: string; body?: unknown; origin?: string } = {}): Request {
  const headers: Record<string, string> = { host: "localhost:3000" };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.origin) headers.origin = opts.origin;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

export const SAMPLE_SOURCE = {
  kind: "csv" as const,
  fileName: "marks.csv",
  warnings: [],
  sheets: [
    {
      id: "s1",
      name: "Sheet1",
      headers: ["Name", "Registration", "Department", "Score"],
      rows: [
        { Name: "Alice", Registration: "R001", Department: "CSE", Score: 78 },
        { Name: "Bob", Registration: "R002", Department: "ECE", Score: 55 },
      ],
    },
  ],
};

export const SAMPLE_CONFIG = {
  activeSheetId: "s1",
  mapping: { studentName: "Name", registration: "Registration", department: "Department", numeric: "Score", category: "Department" },
  chartType: "bar" as const,
  scoreBands: [{ id: "b1", label: "0-100", min: 0, max: 100, tier: "developing" as const }],
  thresholdSupport: 35,
  thresholdStrong: 60,
  chartTitle: "Score Distribution",
  chartAccentIndex: 0,
  normalizeDepartments: true,
  departmentOverrides: {},
};
