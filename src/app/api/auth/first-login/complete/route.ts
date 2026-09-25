import { z } from "zod";
import { getDb } from "@/server/db";
import { json, readJson, requireAuth, route } from "@/server/http";
import { firstLoginComplete } from "@/server/auth/service";
import { requestMeta, setSessionCookie } from "@/server/auth/cookies";

const Body = z.object({
  verificationToken: z.string().min(10).max(200),
  password: z.string().max(200),
  confirmPassword: z.string().max(200),
});

export const POST = route(async (req) => {
  const ctx = await requireAuth(req, undefined, { allowPending: true });
  const body = await readJson(req, Body);
  const session = await firstLoginComplete((await getDb()), ctx, body, requestMeta(req));
  return setSessionCookie(json({ ok: true, next: "/dashboard" }), session.token, session.expiresAt);
});
