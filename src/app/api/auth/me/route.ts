import { json, route, sessionFromRequest } from "@/server/http";
import { toPublicUser } from "@/server/users";

export const GET = route(async (req) => {
  const ctx = await sessionFromRequest(req);
  if (!ctx) return json({ error: "Please sign in to continue.", code: "unauthenticated" }, { status: 401 });
  return json({ user: toPublicUser(ctx.user), stage: ctx.session.stage });
});
