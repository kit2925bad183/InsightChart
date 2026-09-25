import { getDb } from "@/server/db";
import { json, requireAuth, route } from "@/server/http";
import { firstLoginContinue } from "@/server/auth/service";
import { requestMeta, setSessionCookie } from "@/server/auth/cookies";

/** "Continue with current password" on the post-sign-in choice screen. */
export const POST = route(async (req) => {
  const ctx = await requireAuth(req, undefined, { allowPending: true });
  const session = await firstLoginContinue((await getDb()), ctx, requestMeta(req));
  return setSessionCookie(json({ ok: true, next: "/dashboard" }), session.token, session.expiresAt);
});
