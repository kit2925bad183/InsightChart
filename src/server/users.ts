import { randomInt } from "node:crypto";
import { z } from "zod";
import { ApiError, zEmail } from "./http";
import { audit, type Db } from "./db";
import { hashPassword, validateInitialPassword } from "./auth/passwords";
import { deliver, requireMailTransport } from "./email/mailer";
import { accountCreatedEmail } from "./email/templates";
import { ROLES, ROLE_LABELS, canManageUser, creatableRoles, isRole, type Role } from "@/lib/auth/permissions";

/** Any env-like map (process.env or a plain object in tests). */
type Env = Record<string, string | undefined>;

export interface UserRow {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  email: string | null;
  email_verified: number;
  password_hash: string;
  must_change_password: number;
  is_active: number;
  created_by: number | null;
  created_at: number;
  updated_at: number;
  password_changed_at: number | null;
}

/** What is safe to send to a browser — never includes the password hash. */
export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  email: string | null;
  emailVerified: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: number;
  createdBy: number | null;
}

export function toPublicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    role: u.role,
    email: u.email,
    emailVerified: !!u.email_verified,
    isActive: !!u.is_active,
    mustChangePassword: !!u.must_change_password,
    createdAt: u.created_at,
    createdBy: u.created_by,
  };
}

export function findUserById(db: Db, id: number): Promise<UserRow | null> {
  return db.one<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
}

/** Sign-in accepts either the username or the account's email. */
export async function findUserByIdentifier(db: Db, identifier: string): Promise<UserRow | null> {
  const v = identifier.trim();
  if (!v) return null;
  return db.one<UserRow>("SELECT * FROM users WHERE lower(username) = lower($1) OR lower(email) = lower($1) LIMIT 1", [v]);
}

export function findUserByEmail(db: Db, email: string): Promise<UserRow | null> {
  return db.one<UserRow>("SELECT * FROM users WHERE lower(email) = lower($1)", [email.trim()]);
}

export async function listUsers(db: Db): Promise<PublicUser[]> {
  const rows = await db.query<UserRow>(
    "SELECT * FROM users ORDER BY CASE role WHEN 'CREATOR_ADMIN' THEN 0 WHEN 'ADMINISTRATOR' THEN 1 WHEN 'HOD' THEN 2 ELSE 3 END, lower(display_name)"
  );
  return rows.map(toPublicUser);
}

export function allowedEmailDomains(env: Env = process.env): string[] | null {
  const raw = (env.ALLOWED_EMAIL_DOMAINS ?? "gmail.com,googlemail.com").trim();
  if (raw === "*") return null;
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function assertAllowedEmailDomain(email: string) {
  const domains = allowedEmailDomains();
  if (!domains) return;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (!domains.includes(domain)) {
    throw new ApiError(400, `Use a ${domains.map((d) => "@" + d).join(" or ")} address.`, "email_domain_not_allowed");
  }
}

export async function assertEmailAvailable(db: Db, email: string, exceptUserId?: number) {
  const owner = await findUserByEmail(db, email);
  if (owner && owner.id !== exceptUserId) throw new ApiError(409, "That email address is already linked to another account.", "email_taken");
}

function baseUsernameFromEmail(email: string) {
  const local = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return (local || "user").slice(0, 24);
}

async function uniqueUsername(db: Db, base: string) {
  let candidate = base;
  for (let i = 2; await db.one("SELECT 1 FROM users WHERE lower(username) = lower($1)", [candidate]); i++) candidate = `${base}${i}`;
  return candidate;
}

/** What an admin submits to create one account (the form, and each row of a bulk import). */
export const zNewUser = z.object({
  displayName: z.string().trim().min(2, "Enter the person's full name.").max(100),
  email: zEmail,
  role: z.enum(ROLES),
  /** Blank = the server generates one. Either way it is emailed to the person. */
  initialPassword: z.string().max(200).optional(),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(32)
    .regex(/^[A-Za-z0-9._-]+$/, "Username can only contain letters, numbers, dots, dashes and underscores.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export interface CreateUserInput {
  displayName: string;
  email: string;
  role: Role;
  /** Left out or blank = generate one. */
  initialPassword?: string;
  username?: string;
}

// No look-alike characters (0/O, 1/l/I), so a password read from an email is typed right.
const PW_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const PW_DIGITS = "23456789";
const PW_SYMBOLS = "@#$%&*";

/** A random 12-character initial password with letters, digits and a symbol. */
export function generateInitialPassword(): string {
  const pick = (set: string) => set[randomInt(set.length)];
  const chars = [pick(PW_LETTERS.slice(0, 24)), pick(PW_LETTERS.slice(24)), pick(PW_DIGITS), pick(PW_DIGITS), pick(PW_SYMBOLS)];
  const all = PW_LETTERS + PW_DIGITS;
  while (chars.length < 12) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export type AccountEmailResult = { sent: true; to: string } | { sent: false; to: string; error: string };

/** Emails a new (or re-issued) account its sign-in details. Never throws — the caller decides what a failure means. */
export async function sendAccountEmail(user: PublicUser, password: string, loginUrl: string, resent = false): Promise<AccountEmailResult> {
  const to = user.email!;
  try {
    const message = accountCreatedEmail({ to, name: user.displayName, roleLabel: ROLE_LABELS[user.role], username: user.username, password, loginUrl, resent });
    await deliver(requireMailTransport(), message);
    return { sent: true, to };
  } catch (err) {
    return { sent: false, to, error: err instanceof Error ? err.message : "The email couldn't be sent." };
  }
}

export async function createUser(
  db: Db,
  actor: { id: number; role: Role },
  input: CreateUserInput
): Promise<{ user: PublicUser; initialPassword: string }> {
  if (!isRole(input.role) || !creatableRoles(actor.role).includes(input.role)) {
    throw new ApiError(403, "You are not allowed to create that type of account.", "forbidden_role");
  }
  const initialPassword = input.initialPassword?.trim() ? input.initialPassword : generateInitialPassword();
  const pwError = validateInitialPassword(initialPassword);
  if (pwError) throw new ApiError(400, pwError, "weak_password");
  const email = input.email.trim().toLowerCase();
  assertAllowedEmailDomain(email);
  await assertEmailAvailable(db, email);

  let username: string;
  if (input.username) {
    username = input.username.trim();
    if (await db.one("SELECT 1 FROM users WHERE lower(username) = lower($1)", [username])) {
      throw new ApiError(409, "That username is already taken.", "username_taken");
    }
  } else {
    username = await uniqueUsername(db, baseUsernameFromEmail(email));
  }

  const hash = await hashPassword(initialPassword);
  const now = Date.now();
  let row: UserRow | null;
  try {
    row = await db.one<UserRow>(
      `INSERT INTO users (username, display_name, role, email, email_verified, password_hash, must_change_password, is_active, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 0, $5, 1, 1, $6, $7, $8) RETURNING *`,
      [username, input.displayName.trim(), input.role, email, hash, actor.id, now, now]
    );
  } catch (err) {
    // Two admins creating the same person at the same moment: the unique indexes decide.
    if ((err as { code?: string }).code === "23505") throw new ApiError(409, "That username or email address is already in use.", "user_exists");
    throw err;
  }
  await audit(db, actor.id, "user.create", { targetId: row!.id, role: input.role });
  return { user: toPublicUser(row!), initialPassword };
}

/**
 * Issues a fresh initial password to an account that hasn't finished its first sign-in and
 * emails it. The password is only changed once the email has actually been sent, so a
 * failed send leaves the account exactly as it was.
 */
export async function resendAccountDetails(db: Db, actor: { id: number; role: Role }, targetId: number, loginUrl: string): Promise<{ user: PublicUser; to: string }> {
  const target = await loadManageableTarget(db, actor, targetId);
  if (!target.is_active) throw new ApiError(400, "Reactivate this account before sending sign-in details.", "account_inactive");
  if (!target.must_change_password) {
    throw new ApiError(400, "This person has already set their own password. They can use “Forgot password” on the sign-in page.", "already_activated");
  }
  if (!target.email) throw new ApiError(400, "This account has no email address to send to.", "no_email");
  const password = generateInitialPassword();
  const hash = await hashPassword(password);
  const result = await sendAccountEmail(toPublicUser(target), password, loginUrl, true);
  if (!result.sent) throw new ApiError(502, result.error, "email_send_failed");
  await db.query("UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3", [hash, Date.now(), targetId]);
  await db.query("DELETE FROM sessions WHERE user_id = $1", [targetId]);
  await audit(db, actor.id, "user.credentials_resent", { targetId });
  return { user: toPublicUser((await findUserById(db, targetId))!), to: result.to };
}

async function loadManageableTarget(db: Db, actor: { id: number; role: Role }, targetId: number): Promise<UserRow> {
  const target = await findUserById(db, targetId);
  if (!target) throw new ApiError(404, "User not found.", "not_found");
  if (actor.id === target.id) throw new ApiError(403, "You can't change your own account's role or status.", "self_management");
  if (!canManageUser(actor, target)) throw new ApiError(403, "You are not allowed to manage this account.", "forbidden");
  return target;
}

export async function setUserActive(db: Db, actor: { id: number; role: Role }, targetId: number, active: boolean): Promise<PublicUser> {
  await loadManageableTarget(db, actor, targetId);
  await db.query("UPDATE users SET is_active = $1, updated_at = $2 WHERE id = $3", [active ? 1 : 0, Date.now(), targetId]);
  if (!active) await db.query("DELETE FROM sessions WHERE user_id = $1", [targetId]);
  await audit(db, actor.id, active ? "user.reactivate" : "user.deactivate", { targetId });
  return toPublicUser((await findUserById(db, targetId))!);
}

export async function setUserRole(db: Db, actor: { id: number; role: Role }, targetId: number, role: Role): Promise<PublicUser> {
  const target = await loadManageableTarget(db, actor, targetId);
  if (!creatableRoles(actor.role).includes(role)) throw new ApiError(403, "You are not allowed to assign that role.", "forbidden_role");
  if (target.role === role) return toPublicUser(target);
  await db.query("UPDATE users SET role = $1, updated_at = $2 WHERE id = $3", [role, Date.now(), targetId]);
  // Force a fresh sign-in so the new permissions apply everywhere immediately.
  await db.query("DELETE FROM sessions WHERE user_id = $1", [targetId]);
  await audit(db, actor.id, "user.role_change", { targetId, from: target.role, to: role });
  return toPublicUser((await findUserById(db, targetId))!);
}
