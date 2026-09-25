import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { ApiError } from "../http";
import { getMeta, type Db } from "../db";
import { hashToken } from "./sessions";

export type OtpPurpose = "first_login" | "change_password" | "reset_password";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
/** After a correct code, how long the person has to choose the new password. */
export const OTP_VERIFIED_WINDOW_MS = 15 * 60 * 1000;

interface ChallengeRow {
  id: number;
  user_id: number;
  purpose: OtpPurpose;
  email: string;
  code_hash: string;
  attempts: number;
  created_at: number;
  expires_at: number;
  verified_at: number | null;
  consumed_at: number | null;
  token_hash: string | null;
}

async function hashCode(db: Db, challengeId: number, code: string) {
  const pepper = (await getMeta(db, "otp_pepper")) ?? "";
  return createHmac("sha256", pepper).update(`${challengeId}:${code}`).digest("hex");
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** The newest open challenge, row-locked so parallel verify attempts are counted one at a time. */
function latestOpen(db: Db, userId: number, purpose: OtpPurpose): Promise<ChallengeRow | null> {
  return db.one<ChallengeRow>(
    "SELECT * FROM otp_challenges WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL ORDER BY id DESC LIMIT 1 FOR UPDATE",
    [userId, purpose]
  );
}

/** Creates a new challenge (invalidating any earlier open one for the same purpose) and
 * returns the plaintext code so the caller can email it. The code is stored only as an
 * HMAC. Enforces the resend cooldown. */
export function issueOtp(db: Db, userId: number, purpose: OtpPurpose, email: string, now = Date.now()) {
  return db.tx(async (t) => {
    // Serialises concurrent "send code" clicks for the same person and purpose.
    await t.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`otp:${userId}:${purpose}`]);
    const previous = await latestOpen(t, userId, purpose);
    if (previous && now - previous.created_at < OTP_RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - previous.created_at)) / 1000);
      throw new ApiError(429, `Please wait ${wait} seconds before requesting another code.`, "otp_cooldown", { retryAfterSeconds: wait });
    }
    await t.query("UPDATE otp_challenges SET consumed_at = $1 WHERE user_id = $2 AND purpose = $3 AND consumed_at IS NULL", [now, userId, purpose]);

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const { id } = (await t.one<{ id: number }>(
      "INSERT INTO otp_challenges (user_id, purpose, email, code_hash, created_at, expires_at) VALUES ($1, $2, $3, '', $4, $5) RETURNING id",
      [userId, purpose, email, now, now + OTP_TTL_MS]
    ))!;
    await t.query("UPDATE otp_challenges SET code_hash = $1 WHERE id = $2", [await hashCode(t, id, code), id]);
    return { challengeId: id, code, expiresAt: now + OTP_TTL_MS };
  });
}

/** Used when the email could not be delivered: the code must not stay usable. */
export async function cancelOtp(db: Db, challengeId: number) {
  await db.query("DELETE FROM otp_challenges WHERE id = $1", [challengeId]);
}

const INVALID = "That code is incorrect or has expired. Request a new one if needed.";

/** Checks a submitted code. On success returns a one-time token that authorises exactly
 * one password change for this challenge; on failure counts the attempt. */
export async function verifyOtp(db: Db, userId: number, purpose: OtpPurpose, code: string, now = Date.now()) {
  // Failed attempts must be recorded even though an error is thrown, so the transaction
  // returns the outcome and the error is raised after it commits.
  const outcome = await db.tx(async (t) => {
    const ch = await latestOpen(t, userId, purpose);
    if (!ch || ch.verified_at) return { error: new ApiError(400, INVALID, "otp_invalid") };
    if (ch.expires_at <= now) return { error: new ApiError(400, "That code has expired. Request a new one.", "otp_expired") };
    if (ch.attempts >= OTP_MAX_ATTEMPTS) return { error: new ApiError(429, "Too many incorrect attempts. Request a new code.", "otp_locked") };
    if (!safeEqualHex(await hashCode(t, ch.id, code), ch.code_hash)) {
      const attempts = ch.attempts + 1;
      await t.query("UPDATE otp_challenges SET attempts = $1 WHERE id = $2", [attempts, ch.id]);
      if (attempts >= OTP_MAX_ATTEMPTS) {
        await t.query("UPDATE otp_challenges SET consumed_at = $1 WHERE id = $2", [now, ch.id]);
        return { error: new ApiError(429, "Too many incorrect attempts. Request a new code.", "otp_locked") };
      }
      const left = OTP_MAX_ATTEMPTS - attempts;
      return { error: new ApiError(400, `${INVALID} ${left} attempt${left === 1 ? "" : "s"} left.`, "otp_invalid") };
    }
    const token = randomBytes(32).toString("base64url");
    await t.query("UPDATE otp_challenges SET verified_at = $1, token_hash = $2 WHERE id = $3", [now, hashToken(token), ch.id]);
    return { token, email: ch.email };
  });
  if ("error" in outcome) throw outcome.error;
  return outcome;
}

/** Redeems the post-verification token exactly once. Call inside the transaction that
 * applies the password change, so both happen or neither does. */
export async function consumeVerifiedOtp(db: Db, purpose: OtpPurpose, token: string, userId?: number, now = Date.now()) {
  const ch = await db.one<ChallengeRow>("SELECT * FROM otp_challenges WHERE token_hash = $1 AND purpose = $2 AND consumed_at IS NULL FOR UPDATE", [
    hashToken(token),
    purpose,
  ]);
  if (!ch || !ch.verified_at || (userId !== undefined && ch.user_id !== userId)) {
    throw new ApiError(400, "Your verification has expired. Please start again.", "otp_session_invalid");
  }
  if (now - ch.verified_at > OTP_VERIFIED_WINDOW_MS) {
    throw new ApiError(400, "Your verification has expired. Please start again.", "otp_session_invalid");
  }
  await db.query("UPDATE otp_challenges SET consumed_at = $1 WHERE id = $2", [now, ch.id]);
  return { userId: ch.user_id, email: ch.email };
}
