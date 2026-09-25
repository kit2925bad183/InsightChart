import { z } from "zod";
import { getDb } from "@/server/db";
import { json, readJson, requireAuth, route } from "@/server/http";
import { updateDatasetConfig, zConfig } from "@/server/dataset";

const Body = z.object({ config: zConfig });

/** Mapping, bands, thresholds, department corrections — editors only. */
export const PUT = route(async (req) => {
  const { user } = await requireAuth(req, "records:edit");
  const body = await readJson(req, Body);
  const version = await updateDatasetConfig((await getDb()), user.id, body.config);
  return json({ version });
});
