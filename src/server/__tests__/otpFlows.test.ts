import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../db";
import bcrypt from "bcryptjs";
import { addUser, captureMail, codeFrom, freshDb } from "./helpers";
import {
  changePasswordComplete,
  changePasswordSendOtp,
  changePasswordVerifyOtp,
  FORGOT_GENERIC_MESSAGE,
  firstLoginComplete,
  firstLoginContinue,
  firstLoginSendOtp,
  firstLoginVerifyOtp,
  forgotPasswordComplete,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  login,
} from "../auth/service";
import { getSessionByToken } from "../auth/sessions";
import { emailConfigError, explainSmtpError, resolveSmtpSettings, setMailTransportForTests, type MailMessage } from "../email/mailer";
import { ApiError } from "../http";
import { seedInitialAccounts } from "../seed";

const meta = { ip: "127.0.0.1" };
let db: Db;
let mail: MailMessage[];

beforeEach(async () => {
  db = await freshDb();
  mail = captureMail();
});

afterEach(() => {
  setMailTransportForTests(null);
  vi.useRealTimers();
});

async function pendingCtx(identifier: string, password: string) {
  const r = await login(db, { identifier, password }, meta);
  expect(r.stage).toBe("pending");
  return { token: r.token, ctx: (await getSessionByToken(db, r.token))! };
}

async function expectApiError(p: Promise<unknown> | (() => unknown), code: string) {
  try {
    await (typeof p === "function" ? p() : p);
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe(code);
    return err as ApiError;
  }
  throw new Error(`Expected ApiError ${code}`);
}

describe("initial account seeding", () => {
  it("creates both accounts from env vars only when missing, requiring a password change", async () => {
    const r = await seedInitialAccounts(db, { CREATOR_ADMIN_INITIAL_PASSWORD: "Creator#Init1", ADMINISTRATOR_INITIAL_PASSWORD: "Admin#Init22" });
    expect(r.created).toEqual(["createradmin123", "admin123"]);
    const rows = await db.query<{
      username: string;
      role: string;
      must_change_password: number;
      password_hash: string;
    }>("SELECT username, role, must_change_password, password_hash FROM users ORDER BY id");
    expect(rows.map((u) => [u.username, u.role, u.must_change_password])).toEqual([
      ["createradmin123", "CREATOR_ADMIN", 1],
      ["admin123", "ADMINISTRATOR", 1],
    ]);
    // Stored as bcrypt hashes, never plaintext.
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
    expect(rows[0].password_hash).not.toContain("Creator#Init1");

    const again = await seedInitialAccounts(db, { CREATOR_ADMIN_INITIAL_PASSWORD: "Different#1", ADMINISTRATOR_INITIAL_PASSWORD: "Different#2" });
    expect(again.created).toEqual([]);
    expect(bcrypt.compareSync("Creator#Init1", (await db.one<{ password_hash: string }>("SELECT password_hash FROM users WHERE username='createradmin123'"))!.password_hash)).toBe(true);
  });

  it("skips an account whose password env var is missing", async () => {
    const r = await seedInitialAccounts(db, {});
    expect(r.missingPassword).toEqual(["createradmin123", "admin123"]);
    expect(await db.one("SELECT COUNT(*) AS n FROM users")).toEqual({ n: 0 });
  });
});

describe("login", () => {
  it("gives a first-login (pending) session to an account that must change its password", async () => {
    await addUser(db, { username: "Vishvag", role: "CREATOR_ADMIN", password: "Initial#123", mustChange: true });
    const { ctx } = await pendingCtx("Vishvag", "Initial#123");
    expect(ctx.session.stage).toBe("pending");
  });

  it("uses one generic error for unknown users and wrong passwords", async () => {
    await addUser(db, { username: "hod1", role: "HOD", password: "Right#Pass1" });
    const a = await expectApiError(login(db, { identifier: "nobody", password: "x" }, meta), "invalid_credentials");
    const b = await expectApiError(login(db, { identifier: "hod1", password: "wrong" }, meta), "invalid_credentials");
    expect(a.message).toBe(b.message);
  });

  it("checks the role chosen on the sign-in page, only after the password is right", async () => {
    await addUser(db, { username: "admin123", role: "ADMINISTRATOR", password: "Right#Pass1" });
    const wrongRole = await expectApiError(login(db, { identifier: "admin123", password: "Right#Pass1", role: "FACULTY" }, meta), "role_mismatch");
    expect(wrongRole.message).toBe("This isn't a Faculty account — it's an Administrator account.");
    expect(wrongRole.extra).toEqual({ accountRole: "ADMINISTRATOR" });
    // A wrong password with a wrong role still gives the generic error — no role leak.
    await expectApiError(login(db, { identifier: "admin123", password: "nope", role: "FACULTY" }, meta), "invalid_credentials");
    const ok = await login(db, { identifier: "admin123", password: "Right#Pass1", role: "ADMINISTRATOR" }, meta);
    expect(ok.stage).toBe("active");
  });

  it("refuses deactivated accounts", async () => {
    await addUser(db, { username: "fac", role: "FACULTY", password: "Right#Pass1", active: false });
    await expectApiError(login(db, { identifier: "fac", password: "Right#Pass1" }, meta), "account_inactive");
  });

  it("rate-limits repeated failures for one account", async () => {
    await addUser(db, { username: "fac", role: "FACULTY", password: "Right#Pass1" });
    for (let i = 0; i < 8; i++) await expectApiError(login(db, { identifier: "fac", password: "nope" }, { ip: `1.1.1.${i}` }), "invalid_credentials");
    await expectApiError(login(db, { identifier: "fac", password: "Right#Pass1" }, { ip: "1.1.1.99" }), "rate_limited");
  });
});

describe("first-login flow", () => {
  it("Creator Admin registers their own Gmail, verifies the OTP, and sets a new password", async () => {
    const id = await addUser(db, { username: "Vishvag", role: "CREATOR_ADMIN", password: "Initial#123", mustChange: true });
    const { ctx } = await pendingCtx("Vishvag", "Initial#123");

    await firstLoginSendOtp(db, ctx, { email: "vishva.owner@gmail.com" });
    expect(mail).toHaveLength(1);
    expect(mail[0].to).toBe("vishva.owner@gmail.com");
    const code = codeFrom(mail[0]);

    const { verificationToken } = await firstLoginVerifyOtp(db, ctx, { code });
    const session = await firstLoginComplete(db, ctx, { verificationToken, password: "Brand#New2026", confirmPassword: "Brand#New2026" }, meta);

    const user = (await db.one<Record<string, unknown>>("SELECT * FROM users WHERE id = $1", [id]))!;
    expect(user.email).toBe("vishva.owner@gmail.com");
    expect(user.email_verified).toBe(1);
    expect(user.must_change_password).toBe(0);
    expect(bcrypt.compareSync("Brand#New2026", user.password_hash as string)).toBe(true);
    // The pending session is gone; the new one is a full session.
    expect((await getSessionByToken(db, session.token))!.session.stage).toBe("active");
    expect(await db.one("SELECT COUNT(*) AS n FROM sessions WHERE user_id = $1 AND stage = 'pending'", [id])).toEqual({ n: 0 });
  });

  it("requires HOD/Faculty to enter the exact email the Administrator registered", async () => {
    await addUser(db, { username: "hod.cse", role: "HOD", password: "Initial#123", email: "hod.cse@gmail.com", mustChange: true });
    const { ctx } = await pendingCtx("hod.cse", "Initial#123");
    await expectApiError(firstLoginSendOtp(db, ctx, { email: "someone.else@gmail.com" }), "email_mismatch");
    expect(mail).toHaveLength(0);
    await firstLoginSendOtp(db, ctx, { email: "HOD.CSE@gmail.com" });
    expect(mail[0].to).toBe("hod.cse@gmail.com");
  });

  it("rejects non-Gmail addresses by default and emails already used by another account", async () => {
    await addUser(db, { username: "administrator", role: "ADMINISTRATOR", password: "Initial#123", mustChange: true });
    await addUser(db, { username: "other", role: "FACULTY", password: "x#12345678", email: "taken@gmail.com", verified: true });
    const { ctx } = await pendingCtx("administrator", "Initial#123");
    await expectApiError(firstLoginSendOtp(db, ctx, { email: "admin@yahoo.com" }), "email_domain_not_allowed");
    await expectApiError(firstLoginSendOtp(db, ctx, { email: "taken@gmail.com" }), "email_taken");
  });

  it("does not allow keeping the initial password", async () => {
    await addUser(db, { username: "Vishvag", role: "CREATOR_ADMIN", password: "Initial#1234", mustChange: true });
    const { ctx } = await pendingCtx("Vishvag", "Initial#1234");
    await firstLoginSendOtp(db, ctx, { email: "v@gmail.com" });
    const { verificationToken } = await firstLoginVerifyOtp(db, ctx, { code: codeFrom(mail[0]) });
    await expectApiError(firstLoginComplete(db, ctx, { verificationToken, password: "Initial#1234", confirmPassword: "Initial#1234" }, meta), "password_reused");
  });

  it("rejects weak and mismatched new passwords without spending the verification", async () => {
    await addUser(db, { username: "Vishvag", role: "CREATOR_ADMIN", password: "Initial#123", mustChange: true });
    const { ctx } = await pendingCtx("Vishvag", "Initial#123");
    await firstLoginSendOtp(db, ctx, { email: "v@gmail.com" });
    const { verificationToken } = await firstLoginVerifyOtp(db, ctx, { code: codeFrom(mail[0]) });
    await expectApiError(firstLoginComplete(db, ctx, { verificationToken, password: "short1", confirmPassword: "short1" }, meta), "weak_password");
    await expectApiError(firstLoginComplete(db, ctx, { verificationToken, password: "LongEnough#1", confirmPassword: "LongEnough#2" }, meta), "password_mismatch");
    await firstLoginComplete(db, ctx, { verificationToken, password: "LongEnough#1", confirmPassword: "LongEnough#1" }, meta);
  });
});

describe("continue with current password", () => {
  it("signs in without changing anything, and offers the choice again next time", async () => {
    const id = await addUser(db, { username: "admin123", role: "ADMINISTRATOR", password: "kit@2025x", mustChange: true });
    const { token, ctx } = await pendingCtx("admin123", "kit@2025x");
    const active = await firstLoginContinue(db, ctx, meta);
    expect((await getSessionByToken(db, active.token))!.session.stage).toBe("active");
    expect((await getSessionByToken(db, token))).toBeNull();
    const user = await db.one("SELECT must_change_password, email FROM users WHERE id = $1", [id]);
    expect(user).toEqual({ must_change_password: 1, email: null });
    // Next sign-in lands on the choice screen again.
    expect((await login(db, { identifier: "admin123", password: "kit@2025x" }, meta)).stage).toBe("pending");
  });

  it("still allows changing the password by email later from a full session", async () => {
    await addUser(db, { username: "admin123", role: "ADMINISTRATOR", password: "kit@2025x", mustChange: true });
    const { ctx } = await pendingCtx("admin123", "kit@2025x");
    const active = (await getSessionByToken(db, (await firstLoginContinue(db, ctx, meta)).token))!;
    await firstLoginSendOtp(db, active, { email: "admin.owner@gmail.com" });
    const { verificationToken } = await firstLoginVerifyOtp(db, active, { code: codeFrom(mail[0]) });
    await firstLoginComplete(db, active, { verificationToken, password: "Own#Password1", confirmPassword: "Own#Password1" }, meta);
    expect((await login(db, { identifier: "admin123", password: "Own#Password1" }, meta)).stage).toBe("active");
  });

  it("can't be used to skip anything once already signed in", async () => {
    await addUser(db, { username: "fac", role: "FACULTY", password: "Right#Pass1" });
    const r = await login(db, { identifier: "fac", password: "Right#Pass1" }, meta);
    const signedIn = (await getSessionByToken(db, r.token))!;
    await expectApiError(() => firstLoginContinue(db, signedIn, meta), "already_signed_in");
  });
});

describe("email settings", () => {
  it("needs only SMTP_USER and SMTP_PASS for Gmail and strips App Password spaces", () => {
    const r = resolveSmtpSettings({ SMTP_USER: "me@gmail.com", SMTP_PASS: "abcd efgh ijkl mnop" });
    expect(r).toEqual({ settings: { host: "smtp.gmail.com", port: 465, secure: true, user: "me@gmail.com", pass: "abcdefghijklmnop", from: "InsightChart <me@gmail.com>" } });
  });

  it("reports Gmail without credentials as not configured (instead of failing at send time)", () => {
    expect(resolveSmtpSettings({ SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "465", EMAIL_FROM: "InsightChart <your.address@gmail.com>" })).toEqual({
      missing: ["SMTP_USER", "SMTP_PASS"],
    });
    expect(emailConfigError({ SMTP_HOST: "smtp.gmail.com" })).toMatch(/SMTP_USER and SMTP_PASS/);
  });

  it("explains Gmail's authentication errors in plain words", () => {
    expect(explainSmtpError({ code: "EAUTH", responseCode: 535, message: "Username and Password not accepted" }).message).toMatch(/App Password/);
    expect(explainSmtpError({ responseCode: 530, message: "530-5.7.0 Authentication Required" }).code).toBe("email_auth_failed");
    expect(explainSmtpError({ code: "ETIMEDOUT" }).code).toBe("email_unreachable");
  });
});

describe("OTP protections", () => {
  let pendingToken = "";
  async function started() {
    await addUser(db, { username: "Vishvag", role: "CREATOR_ADMIN", password: "Initial#123", mustChange: true });
    const { ctx, token } = await pendingCtx("Vishvag", "Initial#123");
    pendingToken = token;
    await firstLoginSendOtp(db, ctx, { email: "v@gmail.com" });
    return ctx;
  }

  it("fails clearly when email delivery isn't configured — no OTP is created or 'sent'", async () => {
    setMailTransportForTests(null);
    const saved = { ...process.env };
    for (const k of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"]) delete process.env[k];
    try {
      await addUser(db, { username: "Vishvag", role: "CREATOR_ADMIN", password: "Initial#123", mustChange: true });
      const { ctx } = await pendingCtx("Vishvag", "Initial#123");
      const err = await expectApiError(firstLoginSendOtp(db, ctx, { email: "v@gmail.com" }), "email_not_configured");
      expect(err.status).toBe(503);
      expect(err.message).toMatch(/SMTP_HOST/);
      expect(await db.one("SELECT COUNT(*) AS n FROM otp_challenges")).toEqual({ n: 0 });
      await expectApiError(forgotPasswordSendOtp(db, { email: "v@gmail.com" }, meta), "email_not_configured");
    } finally {
      process.env = saved;
    }
  });

  it("does not keep a usable code when the email provider fails", async () => {
    setMailTransportForTests({
      async send() {
        throw new Error("SMTP down");
      },
    });
    await addUser(db, { username: "Vishvag", role: "CREATOR_ADMIN", password: "Initial#123", mustChange: true });
    const { ctx } = await pendingCtx("Vishvag", "Initial#123");
    await expectApiError(firstLoginSendOtp(db, ctx, { email: "v@gmail.com" }), "email_send_failed");
    expect(await db.one("SELECT COUNT(*) AS n FROM otp_challenges")).toEqual({ n: 0 });
  });

  it("stores only a hash of the code", async () => {
    await started();
    const row = (await db.one<{ code_hash: string }>("SELECT code_hash FROM otp_challenges"))!;
    expect(row.code_hash).not.toContain(codeFrom(mail[0]));
    expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("enforces the resend cooldown and invalidates the previous code on resend", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const ctx = await started();
    const first = codeFrom(mail[0]);
    await expectApiError(firstLoginSendOtp(db, ctx, { email: "v@gmail.com" }), "otp_cooldown");
    vi.setSystemTime(Date.now() + 61_000);
    await firstLoginSendOtp(db, ctx, { email: "v@gmail.com" });
    const second = codeFrom(mail[1]);
    if (first !== second) await expectApiError(() => firstLoginVerifyOtp(db, ctx, { code: first }), "otp_invalid");
    expect((await firstLoginVerifyOtp(db, ctx, { code: second })).verificationToken).toBeTruthy();
  });

  it("locks the code after 5 wrong attempts", async () => {
    const ctx = await started();
    const code = codeFrom(mail[0]);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) await expectApiError(() => firstLoginVerifyOtp(db, ctx, { code: wrong }), "otp_invalid");
    await expectApiError(() => firstLoginVerifyOtp(db, ctx, { code: wrong }), "otp_locked");
    // Even the right code no longer works.
    await expectApiError(() => firstLoginVerifyOtp(db, ctx, { code }), "otp_invalid");
  });

  it("expires codes after 10 minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const ctx = await started();
    vi.setSystemTime(Date.now() + 10 * 60_000 + 1);
    await expectApiError(() => firstLoginVerifyOtp(db, ctx, { code: codeFrom(mail[0]) }), "otp_expired");
  });

  it("makes a verified code single-use", async () => {
    const ctx = await started();
    const code = codeFrom(mail[0]);
    const { verificationToken } = await firstLoginVerifyOtp(db, ctx, { code });
    await expectApiError(() => firstLoginVerifyOtp(db, ctx, { code }), "otp_invalid");
    await firstLoginComplete(db, ctx, { verificationToken, password: "Brand#New2026", confirmPassword: "Brand#New2026" }, meta);
    // Replaying the same verification token is refused (the old pending session is also
    // gone, so over HTTP this request wouldn't even authenticate).
    await expectApiError(
      firstLoginComplete(db, ctx, { verificationToken, password: "Another#2026", confirmPassword: "Another#2026" }, meta),
      "otp_session_invalid"
    );
    expect((await getSessionByToken(db, pendingToken))).toBeNull();
  });

  it("limits how many codes can be requested per hour", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const ctx = await started();
    for (let i = 0; i < 4; i++) {
      vi.setSystemTime(Date.now() + 61_000);
      await firstLoginSendOtp(db, ctx, { email: "v@gmail.com" });
    }
    vi.setSystemTime(Date.now() + 61_000);
    await expectApiError(firstLoginSendOtp(db, ctx, { email: "v@gmail.com" }), "rate_limited");
  });
});

describe("change password (signed in)", () => {
  it("sends the code to the verified email, changes the password, and signs out other sessions", async () => {
    const id = await addUser(db, { username: "fac", role: "FACULTY", password: "Current#Pass1", email: "fac@gmail.com", verified: true });
    const a = await login(db, { identifier: "fac", password: "Current#Pass1" }, meta);
    const b = await login(db, { identifier: "fac", password: "Current#Pass1" }, meta);
    const ctx = (await getSessionByToken(db, a.token))!;

    await changePasswordSendOtp(db, ctx);
    expect(mail[0].to).toBe("fac@gmail.com");
    const { verificationToken } = await changePasswordVerifyOtp(db, ctx, { code: codeFrom(mail[0]) });
    await changePasswordComplete(db, ctx, { verificationToken, password: "Updated#Pass2", confirmPassword: "Updated#Pass2" });

    expect((await getSessionByToken(db, a.token))).not.toBeNull();
    expect((await getSessionByToken(db, b.token))).toBeNull();
    const hash = (await db.one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [id]))!.password_hash;
    expect(bcrypt.compareSync("Updated#Pass2", hash)).toBe(true);
    expect(mail.at(-1)!.subject).toMatch(/password was changed/);
  });
});

describe("forgot password", () => {
  it("answers identically for unknown and known emails, but only emails real accounts", async () => {
    await addUser(db, { username: "hod", role: "HOD", password: "Current#Pass1", email: "hod@gmail.com", verified: true });
    const unknown = await forgotPasswordSendOtp(db, { email: "stranger@gmail.com" }, meta);
    expect(mail).toHaveLength(0);
    const known = await forgotPasswordSendOtp(db, { email: "hod@gmail.com" }, meta);
    expect(unknown).toEqual({ message: FORGOT_GENERIC_MESSAGE });
    expect(known).toEqual(unknown);
    expect(mail).toHaveLength(1);
  });

  it("does not send reset codes to accounts that never verified an email", async () => {
    await addUser(db, { username: "new", role: "FACULTY", password: "Initial#123", email: "new@gmail.com", mustChange: true });
    await forgotPasswordSendOtp(db, { email: "new@gmail.com" }, meta);
    expect(mail).toHaveLength(0);
  });

  it("resets the password with a valid code and revokes every session", async () => {
    const id = await addUser(db, { username: "hod", role: "HOD", password: "Current#Pass1", email: "hod@gmail.com", verified: true });
    const s = await login(db, { identifier: "hod", password: "Current#Pass1" }, meta);
    await forgotPasswordSendOtp(db, { email: "hod@gmail.com" }, meta);
    await expectApiError(() => forgotPasswordVerifyOtp(db, { email: "stranger@gmail.com", code: codeFrom(mail[0]) }, meta), "otp_invalid");
    const { verificationToken } = await forgotPasswordVerifyOtp(db, { email: "hod@gmail.com", code: codeFrom(mail[0]) }, meta);
    await forgotPasswordComplete(db, { verificationToken, password: "Reset#Pass123", confirmPassword: "Reset#Pass123" });
    expect((await getSessionByToken(db, s.token))).toBeNull();
    const r = await login(db, { identifier: "hod@gmail.com", password: "Reset#Pass123" }, meta);
    expect(r.stage).toBe("active");
    expect(r.user.id).toBe(id);
  });
});
