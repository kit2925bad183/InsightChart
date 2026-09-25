import { z } from "zod";
import { getDb } from "@/server/db";
import { json, readJson, requireAuth, route, zOtp } from "@/server/http";
import { firstLoginVerifyOtp } from "@/server/auth/service";

const Body = z.object({ code: zOtp });

export const POST = route(async (req) => {
  const ctx = await requireAuth(req, undefined, { allowPending: true });
  const body = await readJson(req, Body);
  return json(await firstLoginVerifyOtp((await getDb()), ctx, body));
});
