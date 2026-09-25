import { createHash, randomBytes } from "node:crypto";
import type { Db } from "../db";
import type { UserRow } from "../users";

export const SESSION_COOKIE = "ic_session";
export const ACTIVE_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
/** A just-signed-in session for an account still on its initial password: it only unlocks
 * the choice screen (change password by email, or continue with the current one). */
export const PENDING_SESSION_TTL_MS = 30 * 60 * 1000;

export type SessionStage = "pending" | "active";

export interface SessionRow {
  id: string;
  user_id: number;
  stage: SessionStage;
  created_at: number;
  expires_at: number;
  last_seen_at: number;
}

export interface SessionContext {
  session: SessionRow;
  user: UserRow;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  db: Db,
  userId: number,
  stage: SessionStage,
  meta: { ip?: string; userAgent?: string } = {}
): Promise<{ token: string; expiresAt: number }> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const expiresAt = now + (stage === "active" ? ACTIVE_SESSION_TTL_MS : PENDING_SESSION_TTL_MS);
  await db.query(
    "INSERT INTO sessions (id, user_id, stage, created_at, expires_at, last_seen_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [hashToken(token), userId, stage, now, expiresAt, now, meta.ip ?? null, meta.userAgent?.slice(0, 300) ?? null]
  );
  // Opportunistic cleanup keeps the table small without a scheduler.
  await db.query("DELETE FROM sessions WHERE expires_at < $1", [now]);
  return { token, expiresAt };
}

type SessionJoin = SessionRow & { [K in keyof UserRow as `u_${K & string}`]: UserRow[K] };

/** Resolves a cookie token to a live session. Returns null (and the caller treats the
 * request as signed out) when the session is expired or the user is deactivated. */
export async function getSessionByToken(db: Db, token: string): Promise<SessionContext | null> {
  if (!token || token.length > 200) return null;
  // One round trip: this runs on every page load and API call.
  const row = await db.one<SessionJoin>(
    `SELECT s.id, s.user_id, s.stage, s.created_at, s.expires_at, s.last_seen_at,
            u.id AS u_id, u.username AS u_username, u.display_name AS u_display_name, u.role AS u_role, u.email AS u_email,
            u.email_verified AS u_email_verified, u.password_hash AS u_password_hash, u.must_change_password AS u_must_change_password,
            u.is_active AS u_is_active, u.created_by AS u_created_by, u.created_at AS u_created_at, u.updated_at AS u_updated_at,
            u.password_changed_at AS u_password_changed_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
    [hashToken(token)]
  );
  if (!row) return null;
  const now = Date.now();
  if (row.expires_at <= now) {
    await db.query("DELETE FROM sessions WHERE id = $1", [row.id]);
    return null;
  }
  if (!row.u_is_active) return null;
  if (now - row.last_seen_at > 60_000) {
    await db.query("UPDATE sessions SET last_seen_at = $1 WHERE id = $2", [now, row.id]);
  }
  const session: SessionRow = { id: row.id, user_id: row.user_id, stage: row.stage, created_at: row.created_at, expires_at: row.expires_at, last_seen_at: row.last_seen_at };
  const user: UserRow = {
    id: row.u_id,
    username: row.u_username,
    display_name: row.u_display_name,
    role: row.u_role,
    email: row.u_email,
    email_verified: row.u_email_verified,
    password_hash: row.u_password_hash,
    must_change_password: row.u_must_change_password,
    is_active: row.u_is_active,
    created_by: row.u_created_by,
    created_at: row.u_created_at,
    updated_at: row.u_updated_at,
    password_changed_at: row.u_password_changed_at,
  };
  return { session, user };
}

export async function revokeSessionByToken(db: Db, token: string) {
  await db.query("DELETE FROM sessions WHERE id = $1", [hashToken(token)]);
}

export async function revokeUserSessions(db: Db, userId: number, exceptSessionId?: string) {
  if (exceptSessionId) await db.query("DELETE FROM sessions WHERE user_id = $1 AND id <> $2", [userId, exceptSessionId]);
  else await db.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

export function sessionCookieOptions(expiresAt: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" && process.env.INSIGHTCHART_INSECURE_COOKIES !== "1",
    path: "/",
    expires: new Date(expiresAt),
  };
}
