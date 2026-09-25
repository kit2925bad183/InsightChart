// E2E harness (started by Playwright's webServer): a throwaway database with one account
// per role, a local SMTP server that captures outgoing mail to a file (so tests read the
// real OTP email the app sent), and the production build of the app on port 3100.
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { SMTPServer } from "smtp-server";
import { E2E } from "./fixtures";

const root = process.cwd();
const dir = path.join(root, ".e2e");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const dbDir = path.join(dir, "pglite");
const mailFile = path.join(dir, "mail.jsonl");

const env = {
  ...process.env,
  // Never the real database: an empty DATABASE_URL wins over .env.local, so the app uses
  // this throwaway embedded Postgres instead.
  DATABASE_URL: "",
  INSIGHTCHART_PGLITE_DIR: dbDir,
  CREATOR_ADMIN_INITIAL_PASSWORD: E2E.creatorInitialPassword,
  ADMINISTRATOR_INITIAL_PASSWORD: E2E.administratorInitialPassword,
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: String(E2E.smtpPort),
  SMTP_SECURE: "false",
  SMTP_USER: "",
  SMTP_PASS: "",
  EMAIL_FROM: "InsightChart Test <noreply@insightchart.test>",
};

async function main() {
  const { openPglite, runMigrations } = await import("../src/server/db");
  const { seedInitialAccounts } = await import("../src/server/seed");
  const db = await openPglite(dbDir);
  await runMigrations(db);
  await seedInitialAccounts(db, env);
  const now = Date.now();
  for (const u of E2E.activeUsers) {
    await db.query(
      `INSERT INTO users (username, display_name, role, email, email_verified, password_hash, must_change_password, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 1, $5, 0, 1, $6, $7)`,
      [u.username, u.displayName, u.role, u.email, bcrypt.hashSync(u.password, 4), now, now]
    );
  }
  // The embedded database allows one process at a time; release it for the app server.
  await db.close();

  const smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS", "AUTH"],
    logger: false,
    onData(stream, session, callback) {
      const chunks: Buffer[] = [];
      stream.on("data", (c: Buffer) => chunks.push(c));
      stream.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        const to = session.envelope.rcptTo.map((r) => r.address.toLowerCase());
        appendFileSync(mailFile, JSON.stringify({ to, raw, at: Date.now() }) + "\n");
        callback();
      });
    },
  });
  await new Promise<void>((resolve) => smtp.listen(E2E.smtpPort, "127.0.0.1", resolve));

  const next = spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(E2E.port)], {
    env: { ...env, NODE_ENV: "production" },
    stdio: "inherit",
  });
  const stop = () => {
    next.kill();
    smtp.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  next.on("exit", (code) => {
    smtp.close();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
