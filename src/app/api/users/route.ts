import { z } from "zod";
import { getDb } from "@/server/db";
import { appUrl, json, readJson, requireAuth, route, zEmail } from "@/server/http";
import { createUser, listUsers, sendAccountEmail } from "@/server/users";
import { ROLES, can, creatableRoles } from "@/lib/auth/permissions";

export const GET = route(async (req) => {
  const { user } = await requireAuth(req, "users:view");
  return json({ users: await listUsers((await getDb())), creatableRoles: creatableRoles(user.role), canManageAdmins: can(user.role, "app:manage") });
});

const Body = z.object({
  displayName: z.string().trim().min(2, "Enter the person's full name.").max(100),
  email: zEmail,
  role: z.enum(ROLES),
  /** Blank = the server generates one. Either way it is emailed to the person. */
  initialPassword: z.string().max(200).optional(),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(32)
    .regex(/^[A-Za-z0-9._-]+$/, "Username can only contain letters, numbers, dots, dashes and underscores.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const POST = route(async (req) => {
  const { user } = await requireAuth(req, "users:create");
  const body = await readJson(req, Body);
  const { user: created, initialPassword } = await createUser((await getDb()), { id: user.id, role: user.role }, body);
  // The account exists either way; if the email fails the admin is told why and can resend.
  const email = await sendAccountEmail(created, initialPassword, `${appUrl(req)}/login`);
  return json({ user: created, email }, { status: 201 });
});
