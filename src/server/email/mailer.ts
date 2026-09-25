import nodemailer from "nodemailer";
import { ApiError } from "../http";

/** Any env-like map (process.env or a plain object in tests). */
type Env = Record<string, string | undefined>;

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

const PLACEHOLDER = /your\.address@|example\.com/i;
const isGmail = (s: string | undefined) => !!s && /(^|\.|@)(gmail|googlemail)\.com$/i.test(s.trim());

/** Works out the SMTP settings from the environment, filling in Gmail defaults so a Gmail
 * setup needs only SMTP_USER and SMTP_PASS. Returns what's missing instead when incomplete. */
export function resolveSmtpSettings(env: Env = process.env): { settings: SmtpSettings } | { missing: string[] } {
  const user = env.SMTP_USER?.trim() || undefined;
  const gmailUser = isGmail(user);
  const host = env.SMTP_HOST?.trim() || (gmailUser ? "smtp.gmail.com" : "");
  const gmailHost = /(^|\.)(gmail|googlemail)\.com$/i.test(host);
  // Google shows App Passwords in groups of four ("abcd efgh ijkl mnop"); the spaces aren't part of it.
  const rawPass = env.SMTP_PASS ?? "";
  const pass = (gmailHost ? rawPass.replace(/\s+/g, "") : rawPass.trim()) || undefined;

  const missing: string[] = [];
  if (!host) missing.push("SMTP_HOST");
  if (gmailHost || user || pass) {
    // Gmail (and any server once one credential is given) needs both.
    if (!user || PLACEHOLDER.test(user)) missing.push("SMTP_USER");
    if (!pass) missing.push("SMTP_PASS");
  }
  const configuredFrom = env.EMAIL_FROM?.trim();
  const from = configuredFrom && !PLACEHOLDER.test(configuredFrom) ? configuredFrom : user ? `InsightChart <${user}>` : "";
  // The sender defaults from SMTP_USER, so only ask for it when there's no user to derive it from.
  if (!from && !missing.includes("SMTP_USER")) missing.push("EMAIL_FROM");
  if (missing.length) return { missing };

  const port = Number(env.SMTP_PORT) || 465;
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE.trim() === "true" : port === 465;
  return { settings: { host, port, secure, user, pass, from } };
}

/** Null when email is ready, otherwise a message naming what's missing. */
export function emailConfigError(env: Env = process.env): string | null {
  const r = resolveSmtpSettings(env);
  if ("settings" in r) return null;
  return `Email sending isn't set up on this server yet, so no verification code can be sent. The site administrator must set ${r.missing.join(
    " and "
  )} in .env.local (for Gmail: your Gmail address and a Google App Password) and restart the server.`;
}

let testTransport: MailTransport | null = null;

/** Test-only: route all mail to an in-memory transport. */
export function setMailTransportForTests(t: MailTransport | null) {
  testTransport = t;
}

export function smtpTransport(s: SmtpSettings): MailTransport {
  const transporter = nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: s.user ? { user: s.user, pass: s.pass } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
  return {
    async send(msg) {
      await transporter.sendMail({ from: s.from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
    },
  };
}

/** Throws a 503 with a clear configuration message instead of pretending to send. */
export function requireMailTransport(env: Env = process.env): MailTransport {
  if (testTransport) return testTransport;
  const r = resolveSmtpSettings(env);
  if (!("settings" in r)) throw new ApiError(503, emailConfigError(env)!, "email_not_configured");
  return smtpTransport(r.settings);
}

/** Turns an SMTP failure into a message a person can act on (no secrets included). */
export function explainSmtpError(err: unknown): { code: string; message: string } {
  const e = err as { code?: string; responseCode?: number; message?: string };
  const text = e?.message ?? "";
  if (e?.code === "EAUTH" || e?.responseCode === 535 || e?.responseCode === 534 || e?.responseCode === 530 || /Authentication Required|Username and Password not accepted/i.test(text)) {
    return {
      code: "email_auth_failed",
      message:
        "The email server rejected the sign-in, so the code couldn't be sent. The site administrator must check SMTP_USER and SMTP_PASS — for Gmail, SMTP_PASS must be a Google App Password (not the normal Gmail password).",
    };
  }
  if (["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ECONNREFUSED"].includes(e?.code ?? "")) {
    return { code: "email_unreachable", message: "Couldn't reach the email server right now. Check the internet connection and try again in a minute." };
  }
  if (e?.responseCode === 550 || e?.responseCode === 553 || /recipient|mailbox/i.test(text)) {
    return { code: "email_rejected", message: "The email server refused that address. Check the email address and try again." };
  }
  return { code: "email_send_failed", message: "We couldn't send the email right now. Please try again in a moment." };
}

export async function deliver(transport: MailTransport, message: MailMessage) {
  try {
    await transport.send(message);
  } catch (err) {
    // Log the provider error for the operator, but never the message body (it holds the code).
    console.error("[insightchart] Email delivery failed:", (err as Error).message);
    const { code, message: text } = explainSmtpError(err);
    throw new ApiError(502, text, code);
  }
}
