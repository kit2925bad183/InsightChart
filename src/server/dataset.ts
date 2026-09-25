import { z } from "zod";
import { ApiError } from "./http";
import { audit, type Db } from "./db";
import { applyRowOp, RowOpError, type DatasetConfig, type DatasetPayload, type RowOp } from "@/lib/datasetEdits";
import type { ParsedSource } from "@/lib/types";

// ─── Validation ─────────────────────────────────────────────────────────────

const zCell = z.union([z.string().max(10_000), z.number(), z.boolean(), z.null()]);
const zRowValues = z.record(z.string().max(500), zCell);

export const zSource = z
  .object({
    kind: z.enum(["xlsx", "csv", "pdf", "docx", "txt", "image"]),
    fileName: z.string().max(255),
    sheets: z
      .array(
        z.object({
          id: z.string().min(1).max(200),
          name: z.string().max(300),
          headers: z.array(z.string().max(500)).max(1000),
          rows: z.array(zRowValues).max(200_000),
        })
      )
      .min(1)
      .max(100),
    warnings: z.array(z.string().max(2000)).max(100),
    rawText: z.string().max(5_000_000).optional(),
  })
  .refine((s) => s.sheets.reduce((n, sh) => n + sh.rows.length, 0) <= 200_000, "Dataset has too many rows (limit 200,000).");

const zBand = z.object({
  id: z.string().max(100),
  label: z.string().max(100),
  min: z.number(),
  max: z.number(),
  tier: z.enum(["support", "developing", "strong"]),
});

export const zConfig = z.object({
  activeSheetId: z.string().max(200).nullable(),
  mapping: z
    .object({
      category: z.string().max(500).optional(),
      numeric: z.string().max(500).optional(),
      studentName: z.string().max(500).optional(),
      registration: z.string().max(500).optional(),
      department: z.string().max(500).optional(),
      subject: z.string().max(500).optional(),
      dateColumn: z.string().max(500).optional(),
      scoreMin: z.number().optional(),
      scoreMax: z.number().optional(),
    })
    .strip(),
  chartType: z.enum(["bar", "grouped-bar", "stacked-bar", "pie", "donut", "line", "area", "scatter", "histogram", "heatmap", "flow", "table"]),
  scoreBands: z.array(zBand).max(20),
  thresholdSupport: z.number(),
  thresholdStrong: z.number(),
  chartTitle: z.string().max(200),
  chartAccentIndex: z.number().int().min(0).max(20),
  normalizeDepartments: z.boolean(),
  departmentOverrides: z.record(z.string().max(500), z.string().max(60)),
});

export const zRowOpBody = z.discriminatedUnion("type", [
  z.object({ type: z.literal("update"), sheetId: z.string(), index: z.number().int(), values: zRowValues, version: z.number().int() }),
  z.object({ type: z.literal("add"), sheetId: z.string(), values: zRowValues, version: z.number().int() }),
  z.object({ type: z.literal("delete"), sheetId: z.string(), index: z.number().int(), version: z.number().int() }),
]);

// ─── Storage ────────────────────────────────────────────────────────────────

interface DatasetRow {
  source_json: string;
  config_json: string;
  source_version: number;
  updated_at: number;
  updated_by: number | null;
  updated_by_name: string | null;
}

function loadRow(db: Db, lock = false): Promise<DatasetRow | null> {
  return db.one<DatasetRow>(
    `SELECT d.source_json, d.config_json, d.source_version, d.updated_at, d.updated_by, u.display_name AS updated_by_name
     FROM datasets d LEFT JOIN users u ON u.id = d.updated_by WHERE d.id = 1${lock ? " FOR UPDATE OF d" : ""}`
  );
}

export async function getDataset(db: Db): Promise<DatasetPayload | null> {
  const row = await loadRow(db);
  if (!row) return null;
  return {
    source: JSON.parse(row.source_json) as ParsedSource,
    config: JSON.parse(row.config_json) as DatasetConfig,
    version: row.source_version,
    updatedAt: row.updated_at,
    updatedByName: row.updated_by_name,
  };
}

export async function replaceDataset(db: Db, userId: number, source: ParsedSource, config: DatasetConfig): Promise<number> {
  // One statement: the version bump is atomic even with several uploads racing.
  const row = await db.one<{ source_version: number }>(
    `INSERT INTO datasets (id, source_json, config_json, source_version, updated_by, updated_at) VALUES (1, $1, $2, 1, $3, $4)
     ON CONFLICT (id) DO UPDATE SET source_json = EXCLUDED.source_json, config_json = EXCLUDED.config_json,
       source_version = datasets.source_version + 1, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at
     RETURNING source_version`,
    [JSON.stringify(source), JSON.stringify(config), userId, Date.now()]
  );
  const version = row!.source_version;
  const rows = source.sheets.reduce((n, s) => n + s.rows.length, 0);
  await audit(db, userId, "dataset.replace", { fileName: source.fileName, rows, version });
  return version;
}

export async function updateDatasetConfig(db: Db, userId: number, config: DatasetConfig): Promise<number> {
  const row = await db.one<{ source_version: number }>(
    "UPDATE datasets SET config_json = $1, updated_by = $2, updated_at = $3 WHERE id = 1 RETURNING source_version",
    [JSON.stringify(config), userId, Date.now()]
  );
  if (!row) throw new ApiError(404, "There is no saved dataset to update.", "no_dataset");
  return row.source_version;
}

export async function clearDataset(db: Db, userId: number) {
  await db.query("DELETE FROM datasets WHERE id = 1");
  await audit(db, userId, "dataset.clear");
}

/** Applies one record edit with optimistic concurrency: rows are addressed by index, so
 * an edit made against an older version could hit the wrong student — reject instead. */
export function applyDatasetRowOp(db: Db, userId: number, op: RowOp, expectedVersion: number): Promise<number> {
  return db.tx(async (t) => {
    const current = await loadRow(t, true);
    if (!current) throw new ApiError(404, "There is no saved dataset to edit.", "no_dataset");
    if (current.source_version !== expectedVersion) {
      throw new ApiError(409, "Someone else changed this data since you loaded it. Reload the page and try again.", "version_conflict");
    }
    let next: ParsedSource;
    try {
      next = applyRowOp(JSON.parse(current.source_json) as ParsedSource, op);
    } catch (err) {
      if (err instanceof RowOpError) throw new ApiError(400, err.message, "invalid_row_op");
      throw err;
    }
    const version = current.source_version + 1;
    await t.query("UPDATE datasets SET source_json = $1, source_version = $2, updated_by = $3, updated_at = $4 WHERE id = 1", [
      JSON.stringify(next),
      version,
      userId,
      Date.now(),
    ]);
    await audit(t, userId, `dataset.row_${op.type}`, { sheetId: op.sheetId, index: "index" in op ? op.index : undefined, version });
    return version;
  });
}
