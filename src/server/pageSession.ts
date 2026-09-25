import { cookies } from "next/headers";
import { getDb } from "./db";
import { SESSION_COOKIE, getSessionByToken } from "./auth/sessions";
import type { SessionUser } from "@/lib/auth/session";

/** Session lookup for Server Components (layouts/pages). */
export async function getPageSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? getSessionByToken(await getDb(), token) : null;
}

export function toSessionUser(u: {
  id: number;
  username: string;
  display_name: string;
  role: SessionUser["role"];
  email: string | null;
  email_verified: number;
  must_change_password: number;
}): SessionUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    role: u.role,
    email: u.email,
    emailVerified: !!u.email_verified,
    mustChangePassword: !!u.must_change_password,
  };
}
