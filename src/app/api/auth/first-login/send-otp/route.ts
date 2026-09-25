import { z } from "zod";
import { getDb } from "@/server/db";
import { json, readJson, requireAuth, route, zEmail } from "@/server/http";
import { firstLoginSendOtp } from "@/server/auth/service";

const Body = z.object({ email: zEmail });

export const POST = route(async (req) => {
  const ctx = await requireAuth(req, undefined, { allowPending: true });
  const body = await readJson(req, Body);
  return json(await firstLoginSendOtp((await getDb()), ctx, body));
});
