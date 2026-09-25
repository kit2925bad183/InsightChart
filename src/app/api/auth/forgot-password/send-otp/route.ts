import { z } from "zod";
import { getDb } from "@/server/db";
import { json, readJson, route, zEmail } from "@/server/http";
import { forgotPasswordSendOtp } from "@/server/auth/service";
import { requestMeta } from "@/server/auth/cookies";

const Body = z.object({ email: zEmail });

export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  return json(await forgotPasswordSendOtp((await getDb()), body, requestMeta(req)));
});
