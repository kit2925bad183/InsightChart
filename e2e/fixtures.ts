import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// Test-only credentials for the throwaway e2e database. They exist nowhere else.
export const E2E = {
  port: 3100,
  smtpPort: 2526,
  creatorInitialPassword: "E2E-creator-initial-1",
  administratorInitialPassword: "E2E-admin-initial-1",
  activeUsers: [
    { key: "admin", username: "e2e.admin", displayName: "Asha Admin", role: "ADMINISTRATOR", email: "e2e.admin@gmail.com", password: "E2E-admin-Pass-2026" },
    { key: "hod", username: "e2e.hod", displayName: "Hari HOD", role: "HOD", email: "e2e.hod@gmail.com", password: "E2E-hod-Pass-2026" },
    { key: "faculty", username: "e2e.faculty", displayName: "Fatima Faculty", role: "FACULTY", email: "e2e.faculty@gmail.com", password: "E2E-faculty-Pass-2026" },
  ],
} as const;

export type RoleKey = (typeof E2E.activeUsers)[number]["key"];

export const storageStatePath = (key: RoleKey) => path.join(process.cwd(), ".e2e", `${key}.storage.json`);

const mailFile = () => path.join(process.cwd(), ".e2e", "mail.jsonl");

/** Waits for the newest email to `to` (after `since`) whose text has a "<label>: <value>" line, and returns the value. */
export async function waitForMailField(to: string, since: number, label: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const re = new RegExp(`^${label}: (\\S+)\\r?$`, "m");
  while (Date.now() < deadline) {
    if (existsSync(mailFile())) {
      const mails = readFileSync(mailFile(), "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as { to: string[]; raw: string; at: number })
        .filter((m) => m.at >= since && m.to.includes(to.toLowerCase()));
      for (const m of mails.reverse()) {
        // Undo quoted-printable soft line breaks and escapes before searching.
        const text = m.raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
        const value = re.exec(text)?.[1];
        if (value) return value;
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No email to ${to} with "${label}" arrived within ${timeoutMs}ms`);
}

/** Waits for the newest OTP email sent to `to` (after `since`) and returns its code. */
export async function waitForOtp(to: string, since: number, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(mailFile())) {
      const mails = readFileSync(mailFile(), "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as { to: string[]; raw: string; at: number })
        .filter((m) => m.at >= since && m.to.includes(to.toLowerCase()));
      const last = mails.at(-1);
      // Undo quoted-printable soft line breaks before searching.
      const code = last && /Your code: (\d{6})/.exec(last.raw.replace(/=\r?\n/g, ""))?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No OTP email to ${to} arrived within ${timeoutMs}ms`);
}
