import { z } from "zod";
import { getDb } from "@/server/db";
import { json, readJson, route, zEmail, zOtp } from "@/server/http";
import { forgotPasswordVerifyOtp } from "@/server/auth/service";
import { requestMeta } from "@/server/auth/cookies";

const Body = z.object({ email: zEmail, code: zOtp });

export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  return json(await forgotPasswordVerifyOtp((await getDb()), body, requestMeta(req)));
});
