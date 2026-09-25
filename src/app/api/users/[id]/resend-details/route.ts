import { getDb } from "@/server/db";
import { ApiError, appUrl, json, requireAuth, route } from "@/server/http";
import { resendAccountDetails } from "@/server/users";

/** Emails a fresh initial password to an account that hasn't completed its first sign-in. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireAuth(req, "users:manage");
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid user id.", "invalid_request");
  const result = await resendAccountDetails((await getDb()), { id: user.id, role: user.role }, id, `${appUrl(req)}/login`);
  return json(result);
});
