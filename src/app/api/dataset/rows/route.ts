import { getDb } from "@/server/db";
import { json, readJson, requireAuth, route } from "@/server/http";
import { applyDatasetRowOp, zRowOpBody } from "@/server/dataset";

/** Add, edit or delete one student record — editors only. */
export const POST = route(async (req) => {
  const { user } = await requireAuth(req, "records:edit");
  const { version: expected, ...op } = await readJson(req, zRowOpBody);
  const db = await getDb();
  const version = await applyDatasetRowOp(db, user.id, op, expected);
  return json({ version });
});
