import { getDb } from "@/server/db";
import { json, readCookie, route } from "@/server/http";
import { SESSION_COOKIE, revokeSessionByToken } from "@/server/auth/sessions";
import { clearSessionCookie } from "@/server/auth/cookies";

export const POST = route(async (req) => {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) await revokeSessionByToken((await getDb()), token);
  return clearSessionCookie(json({ ok: true }));
});
