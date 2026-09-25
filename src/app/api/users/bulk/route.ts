import { z } from "zod";
import { getDb } from "@/server/db";
import { ApiError, appUrl, json, readJson, requireAuth, route } from "@/server/http";
import { createUser, sendAccountEmail, zNewUser, type AccountEmailResult } from "@/server/users";
import { enforceRateLimit } from "@/server/auth/rateLimit";

/** People per request. The browser sends a long list in batches of this size, so each
 * request (one welcome email per person) finishes well within serverless time limits. */
const BATCH = 10;

const Body = z.object({ users: z.array(z.unknown()).min(1).max(BATCH) });

type Result =
  | { index: number; ok: true; username: string; email: AccountEmailResult }
  | { index: number; ok: false; error: string };

/** Creates several accounts and emails each person their sign-in details. Every row is
 * validated and created on its own, so one bad row never blocks the others. */
export const POST = route(async (req) => {
  const { user } = await requireAuth(req, "users:create");
  const db = await getDb();
  // Gmail allows ~500 messages a day; this keeps a runaway import well below that.
  await enforceRateLimit(db, `bulk-create:${user.id}`, 40, 60 * 60 * 1000, "Too many accounts created in the last hour.");
  const { users } = await readJson(req, Body);
  const loginUrl = `${appUrl(req)}/login`;

  const results: Result[] = [];
  for (const [index, raw] of users.entries()) {
    const parsed = zNewUser.omit({ initialPassword: true }).safeParse(raw);
    if (!parsed.success) {
      results.push({ index, ok: false, error: parsed.error.issues[0]?.message ?? "Invalid row." });
      continue;
    }
    try {
      const { user: created, initialPassword } = await createUser(db, { id: user.id, role: user.role }, parsed.data);
      results.push({ index, ok: true, username: created.username, email: await sendAccountEmail(created, initialPassword, loginUrl) });
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      results.push({ index, ok: false, error: err.message });
    }
  }
  return json({ results });
});
