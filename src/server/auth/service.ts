import { ApiError } from "../http";
import { audit, type Db } from "../db";
import { assertAllowedEmailDomain, assertEmailAvailable, findUserByEmail, findUserById, findUserByIdentifier, type UserRow } from "../users";
import { burnPasswordCheck, hashPassword, validateNewPassword, verifyPassword } from "./passwords";
import { clearRateLimit, enforceRateLimit } from "./rateLimit";
import { createSession, revokeUserSessions, type SessionContext } from "./sessions";
import { OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS, cancelOtp, consumeVerifiedOtp, issueOtp, verifyOtp, type OtpPurpose } from "./otp";
import { deliver, requireMailTransport, type MailTransport } from "../email/mailer";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { otpEmail, passwordChangedEmail } from "../email/templates";

export interface RequestMeta {
  ip: string;
  userAgent?: string;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const GENERIC_LOGIN_ERROR = "Incorrect username or password.";

export const FORGOT_GENERIC_MESSAGE =
  "If that email belongs to an InsightChart account with a verified address, we've sent a 6-digit code to it. It expires in 10 minutes.";

function newPasswordChecks(password: string, confirm: string) {
  if (password !== confirm) throw new ApiError(400, "The two passwords don't match.", "password_mismatch");
  const err = validateNewPassword(password);
  if (err) throw new ApiError(400, err, "weak_password");
}

// ─── Sign in ────────────────────────────────────────────────────────────────

export async function login(db: Db, input: { identifier: string; password: string; role?: Role }, meta: RequestMeta) {
  const idKey = input.identifier.trim().toLowerCase();
  await enforceRateLimit(db, `login:ip:${meta.ip}`, 30, 15 * MINUTE, "Too many sign-in attempts from this network.");
  await enforceRateLimit(db, `login:id:${idKey}`, 8, 15 * MINUTE, "Too many sign-in attempts for this account.");

  const user = await findUserByIdentifier(db, input.identifier);
  if (!user) {
    await burnPasswordCheck(input.password);
    throw new ApiError(401, GENERIC_LOGIN_ERROR, "invalid_credentials");
  }
  if (!(await verifyPassword(input.password, user.password_hash))) {
    await audit(db, user.id, "auth.login_failed");
    throw new ApiError(401, GENERIC_LOGIN_ERROR, "invalid_credentials");
  }
  if (!user.is_active) throw new ApiError(403, "This account has been deactivated. Contact your administrator.", "account_inactive");
  // The sign-in page asks which kind of user is signing in. Checked only after the
  // password matched, so it never reveals anything about accounts to a stranger.
  if (input.role && input.role !== user.role) {
    const article = (label: string) => (/^[AEIOU]/i.test(label) ? "an" : "a");
    throw new ApiError(
      403,
      `This isn't ${article(ROLE_LABELS[input.role])} ${ROLE_LABELS[input.role]} account — it's ${article(ROLE_LABELS[user.role])} ${ROLE_LABELS[user.role]} account.`,
      "role_mismatch",
      // Lets the sign-in page offer a one-click switch to the right role.
      { accountRole: user.role }
    );
  }

  await clearRateLimit(db, `login:id:${idKey}`);
  const stage = user.must_change_password ? "pending" : "active";
  const { token, expiresAt } = await createSession(db, user.id, stage, meta);
  await audit(db, user.id, "auth.login", { stage });
  return { token, expiresAt, stage, user } as const;
}

// ─── Shared OTP sending ─────────────────────────────────────────────────────

async function sendOtp(db: Db, transport: MailTransport, user: UserRow, purpose: OtpPurpose, email: string) {
  await enforceRateLimit(db, `otp-send:${purpose}:${user.id}`, 5, HOUR, "Too many codes requested.");
  const { challengeId, code } = await issueOtp(db, user.id, purpose, email);
  try {
    await deliver(transport, otpEmail({ to: email, name: user.display_name, purpose, code, minutes: OTP_TTL_MS / MINUTE }));
  } catch (err) {
    await cancelOtp(db, challengeId);
    throw err;
  }
  await audit(db, user.id, "otp.sent", { purpose });
  return {
    email,
    expiresInSeconds: OTP_TTL_MS / 1000,
    resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
  };
}

async function verifyWithLimit(db: Db, userId: number, purpose: OtpPurpose, code: string) {
  await enforceRateLimit(db, `otp-verify:${purpose}:${userId}`, 20, HOUR, "Too many verification attempts.");
  return verifyOtp(db, userId, purpose, code);
}

// ─── First login ────────────────────────────────────────────────────────────

/** True for accounts whose email was set by the administrator who created them. */
export function hasRegisteredEmail(user: Pick<UserRow, "role" | "created_by" | "email">): boolean {
  return user.role === "HOD" || user.role === "FACULTY" || (user.created_by !== null && !!user.email);
}

/** The email-verified password change is available to anyone still on the initial
 * password — right after sign-in, or later from their account page. */
function requirePending(ctx: SessionContext) {
  if (!ctx.user.must_change_password) {
    throw new ApiError(400, "Your account is already set up.", "already_activated");
  }
}

/** "Continue with current password": upgrade this sign-in to a full session without
 * changing anything. The account stays on its initial password, so the choice is offered
 * again at the next sign-in until the person changes it. */
export function firstLoginContinue(db: Db, ctx: SessionContext, meta: RequestMeta) {
  if (ctx.session.stage !== "pending") throw new ApiError(400, "You're already signed in.", "already_signed_in");
  return db.tx(async (t) => {
    await t.query("DELETE FROM sessions WHERE id = $1", [ctx.session.id]);
    const session = await createSession(t, ctx.user.id, "active", meta);
    await audit(t, ctx.user.id, "auth.kept_initial_password");
    return session;
  });
}

/** Step 2+3: confirm the person's email and send the code there. Accounts an administrator
 * created must use the address the administrator registered (where their sign-in details
 * were emailed); the two initial accounts register their own address here. */
export async function firstLoginSendOtp(db: Db, ctx: SessionContext, input: { email: string }) {
  requirePending(ctx);
  const transport = requireMailTransport();
  const email = input.email.trim().toLowerCase();
  assertAllowedEmailDomain(email);
  const user = ctx.user;
  if (hasRegisteredEmail(user)) {
    if (!user.email || user.email.toLowerCase() !== email) {
      throw new ApiError(400, "That isn't the email address your administrator registered for this account.", "email_mismatch");
    }
  } else {
    await assertEmailAvailable(db, email, user.id);
  }
  return sendOtp(db, transport, user, "first_login", email);
}

export async function firstLoginVerifyOtp(db: Db, ctx: SessionContext, input: { code: string }) {
  requirePending(ctx);
  const { token } = await verifyWithLimit(db, ctx.user.id, "first_login", input.code);
  return { verificationToken: token };
}

/** Steps 5+6: set the new password, bind the verified email, and upgrade to a full session. */
export async function firstLoginComplete(
  db: Db,
  ctx: SessionContext,
  input: { verificationToken: string; password: string; confirmPassword: string },
  meta: RequestMeta
) {
  requirePending(ctx);
  newPasswordChecks(input.password, input.confirmPassword);
  if (await verifyPassword(input.password, ctx.user.password_hash)) {
    throw new ApiError(400, "Choose a new password — it can't be the same as your initial password.", "password_reused");
  }
  const hash = await hashPassword(input.password);
  return db.tx(async (t) => {
    const { email } = await consumeVerifiedOtp(t, "first_login", input.verificationToken, ctx.user.id);
    await assertEmailAvailable(t, email, ctx.user.id);
    const now = Date.now();
    await t.query(
      `UPDATE users SET password_hash = $1, must_change_password = 0, email = $2, email_verified = 1,
         password_changed_at = $3, updated_at = $4 WHERE id = $5`,
      [hash, email, now, now, ctx.user.id]
    );
    await revokeUserSessions(t, ctx.user.id);
    const session = await createSession(t, ctx.user.id, "active", meta);
    await audit(t, ctx.user.id, "auth.first_login_completed");
    return session;
  });
}

// ─── Change password (signed in) ────────────────────────────────────────────

function requireVerifiedEmail(user: UserRow): string {
  if (!user.email || !user.email_verified) {
    throw new ApiError(400, "Your account has no verified email address.", "no_verified_email");
  }
  return user.email;
}

export async function changePasswordSendOtp(db: Db, ctx: SessionContext) {
  const email = requireVerifiedEmail(ctx.user);
  const transport = requireMailTransport();
  return sendOtp(db, transport, ctx.user, "change_password", email);
}

export async function changePasswordVerifyOtp(db: Db, ctx: SessionContext, input: { code: string }) {
  requireVerifiedEmail(ctx.user);
  const { token } = await verifyWithLimit(db, ctx.user.id, "change_password", input.code);
  return { verificationToken: token };
}

export async function changePasswordComplete(
  db: Db,
  ctx: SessionContext,
  input: { verificationToken: string; password: string; confirmPassword: string }
) {
  newPasswordChecks(input.password, input.confirmPassword);
  const hash = await hashPassword(input.password);
  await db.tx(async (t) => {
    await consumeVerifiedOtp(t, "change_password", input.verificationToken, ctx.user.id);
    const now = Date.now();
    await t.query("UPDATE users SET password_hash = $1, password_changed_at = $2, updated_at = $3 WHERE id = $4", [hash, now, now, ctx.user.id]);
    await revokeUserSessions(t, ctx.user.id, ctx.session.id);
    await audit(t, ctx.user.id, "auth.password_changed");
  });
  await notifyPasswordChanged(ctx.user);
}

// ─── Forgot password (public) ───────────────────────────────────────────────

function eligibleForReset(user: UserRow | null): user is UserRow {
  return !!user && !!user.is_active && !!user.email_verified && !user.must_change_password;
}

/** Always answers the same way whether or not the email matches an account. */
export async function forgotPasswordSendOtp(db: Db, input: { email: string }, meta: RequestMeta) {
  const transport = requireMailTransport();
  const email = input.email.trim().toLowerCase();
  await enforceRateLimit(db, `forgot:ip:${meta.ip}`, 10, HOUR, "Too many reset requests.");
  await enforceRateLimit(db, `forgot:email:${email}`, 5, HOUR, "Too many reset requests.");

  const user = await findUserByEmail(db, email);
  if (eligibleForReset(user)) {
    try {
      await sendOtp(db, transport, user, "reset_password", user.email!);
    } catch (err) {
      // Cooldown/limit/delivery problems for a real account must not look different
      // from "no such account" — log for the operator, answer generically.
      console.warn("[insightchart] Password reset code not sent:", (err as Error).message);
    }
  }
  return { message: FORGOT_GENERIC_MESSAGE };
}

export async function forgotPasswordVerifyOtp(db: Db, input: { email: string; code: string }, meta: RequestMeta) {
  await enforceRateLimit(db, `forgot-verify:ip:${meta.ip}`, 30, HOUR, "Too many verification attempts.");
  const user = await findUserByEmail(db, input.email);
  if (!eligibleForReset(user)) {
    throw new ApiError(400, "That code is incorrect or has expired. Request a new one if needed.", "otp_invalid");
  }
  const { token } = await verifyWithLimit(db, user.id, "reset_password", input.code);
  return { verificationToken: token };
}

export async function forgotPasswordComplete(
  db: Db,
  input: { verificationToken: string; password: string; confirmPassword: string }
) {
  newPasswordChecks(input.password, input.confirmPassword);
  const hash = await hashPassword(input.password);
  const userId = await db.tx(async (t) => {
    const { userId } = await consumeVerifiedOtp(t, "reset_password", input.verificationToken);
    const now = Date.now();
    await t.query("UPDATE users SET password_hash = $1, password_changed_at = $2, updated_at = $3 WHERE id = $4", [hash, now, now, userId]);
    await revokeUserSessions(t, userId);
    await audit(t, userId, "auth.password_reset");
    return userId;
  });
  const user = await findUserById(db, userId);
  if (user) await notifyPasswordChanged(user);
}

async function notifyPasswordChanged(user: UserRow) {
  if (!user.email) return;
  try {
    await deliver(requireMailTransport(), passwordChangedEmail({ to: user.email, name: user.display_name }));
  } catch {
    // Best effort — the password change itself already succeeded.
  }
}
