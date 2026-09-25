import { z } from "zod";
import { getDb } from "@/server/db";
import { json, readJson, route } from "@/server/http";
import { forgotPasswordComplete } from "@/server/auth/service";

const Body = z.object({
  verificationToken: z.string().min(10).max(200),
  password: z.string().max(200),
  confirmPassword: z.string().max(200),
});

export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  await forgotPasswordComplete((await getDb()), body);
  return json({ ok: true, next: "/login" });
});
