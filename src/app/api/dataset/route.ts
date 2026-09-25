import { z } from "zod";
import { getDb } from "@/server/db";
import { json, jsonCompressed, readJson, requireAuth, route } from "@/server/http";
import { clearDataset, getDataset, replaceDataset, zConfig, zSource } from "@/server/dataset";

/** Every signed-in role can read the shared dataset. */
export const GET = route(async (req) => {
  await requireAuth(req, "data:view");
  return jsonCompressed(req, { dataset: await getDataset(await getDb()) });
});

const PutBody = z.object({ source: zSource, config: zConfig });

/** Upload/replace the dataset — editors only. */
export const PUT = route(async (req) => {
  const { user } = await requireAuth(req, "records:edit");
  const body = await readJson(req, PutBody);
  const db = await getDb();
  const version = await replaceDataset(db, user.id, body.source, body.config);
  return json({ version });
});

/** Reset to the built-in sample data — editors only. */
export const DELETE = route(async (req) => {
  const { user } = await requireAuth(req, "records:edit");
  await clearDataset(await getDb(), user.id);
  return json({ ok: true });
});
