import { getDb } from "@/server/db";
import { json, requireAuth, route } from "@/server/http";
import { changePasswordSendOtp } from "@/server/auth/service";

export const POST = route(async (req) => {
  const ctx = await requireAuth(req);
  return json(await changePasswordSendOtp((await getDb()), ctx));
});
