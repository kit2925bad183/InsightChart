import { getDb } from "@/server/db";
import { appUrl, json, readJson, requireAuth, route } from "@/server/http";
import { allowedEmailDomains, createUser, listUsers, sendAccountEmail, zNewUser } from "@/server/users";
import { can, creatableRoles } from "@/lib/auth/permissions";

export const GET = route(async (req) => {
  const { user } = await requireAuth(req, "users:view");
  return json({
    users: await listUsers(await getDb()),
    creatableRoles: creatableRoles(user.role),
    canManageAdmins: can(user.role, "app:manage"),
    allowedEmailDomains: allowedEmailDomains(),
  });
});

export const POST = route(async (req) => {
  const { user } = await requireAuth(req, "users:create");
  const body = await readJson(req, zNewUser);
  const { user: created, initialPassword } = await createUser(await getDb(), { id: user.id, role: user.role }, body);
  // The account exists either way; if the email fails the admin is told why and can resend.
  const email = await sendAccountEmail(created, initialPassword, `${appUrl(req)}/login`);
  return json({ user: created, email }, { status: 201 });
});
