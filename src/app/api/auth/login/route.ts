import { z } from "zod";
import { getDb } from "@/server/db";
import { json, readJson, route } from "@/server/http";
import { login } from "@/server/auth/service";
import { requestMeta, setSessionCookie } from "@/server/auth/cookies";
import { toPublicUser } from "@/server/users";
import { ROLES } from "@/lib/auth/permissions";

const Body = z.object({
  identifier: z.string().trim().min(1, "Enter your username or email.").max(254),
  password: z.string().min(1, "Enter your password.").max(200),
  /** The role picked on the sign-in page; must match the account's role when given. */
  role: z.enum(ROLES).optional(),
});

export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  const result = await login((await getDb()), body, requestMeta(req));
  const res = json({
    stage: result.stage,
    next: result.stage === "pending" ? "/first-login" : "/dashboard",
    user: toPublicUser(result.user),
  });
  return setSessionCookie(res, result.token, result.expiresAt);
});
