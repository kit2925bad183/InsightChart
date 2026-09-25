import { z } from "zod";
import { getDb } from "@/server/db";
import { ApiError, json, readJson, requireAuth, route } from "@/server/http";
import { setUserActive, setUserRole } from "@/server/users";
import { ROLES } from "@/lib/auth/permissions";

const Body = z
  .object({ isActive: z.boolean().optional(), role: z.enum(ROLES).optional() })
  .refine((b) => b.isActive !== undefined || b.role !== undefined, "Nothing to update.");

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireAuth(req, "users:manage");
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid user id.", "invalid_request");
  const body = await readJson(req, Body);
  const db = await getDb();
  const actor = { id: user.id, role: user.role };
  let result = null;
  if (body.role !== undefined) result = await setUserRole(db, actor, id, body.role);
  if (body.isActive !== undefined) result = await setUserActive(db, actor, id, body.isActive);
  return json({ user: result });
});
