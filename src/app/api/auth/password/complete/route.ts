import { z } from "zod";
import { getDb } from "@/server/db";
import { json, readJson, requireAuth, route } from "@/server/http";
import { changePasswordComplete } from "@/server/auth/service";

const Body = z.object({
  verificationToken: z.string().min(10).max(200),
  password: z.string().max(200),
  confirmPassword: z.string().max(200),
});

export const POST = route(async (req) => {
  const ctx = await requireAuth(req);
  const body = await readJson(req, Body);
  await changePasswordComplete((await getDb()), ctx, body);
  return json({ ok: true });
});
