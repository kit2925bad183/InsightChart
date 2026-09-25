// Pure record-edit operations shared by the API (authoritative) and the client (to mirror
// a successful save locally without re-downloading the whole dataset).

import type { CellValue, ChartType, ColumnMapping, ParsedSource, ScoreBand } from "./types";

/** Everything about how the shared dataset is interpreted, saved alongside it. */
export interface DatasetConfig {
  activeSheetId: string | null;
  mapping: ColumnMapping;
  chartType: ChartType;
  scoreBands: ScoreBand[];
  thresholdSupport: number;
  thresholdStrong: number;
  chartTitle: string;
  chartAccentIndex: number;
  normalizeDepartments: boolean;
  departmentOverrides: Record<string, string>;
}

export interface DatasetPayload {
  source: ParsedSource;
  config: DatasetConfig;
  version: number;
  updatedAt: number;
  updatedByName: string | null;
}

export type RowOp =
  | { type: "update"; sheetId: string; index: number; values: Record<string, CellValue> }
  | { type: "add"; sheetId: string; values: Record<string, CellValue> }
  | { type: "delete"; sheetId: string; index: number };

export class RowOpError extends Error {}

/** Returns a new source with the op applied; throws RowOpError for an invalid op. Only
 * existing columns can be written — an edit can't smuggle in new fields. */
export function applyRowOp(source: ParsedSource, op: RowOp): ParsedSource {
  const sheetIdx = source.sheets.findIndex((s) => s.id === op.sheetId);
  if (sheetIdx === -1) throw new RowOpError("That sheet no longer exists.");
  const sheet = source.sheets[sheetIdx];

  if (op.type !== "delete") {
    const unknown = Object.keys(op.values).filter((k) => !sheet.headers.includes(k));
    if (unknown.length) throw new RowOpError(`Unknown column: ${unknown[0]}`);
  }
  if (op.type !== "add" && (!Number.isInteger(op.index) || op.index < 0 || op.index >= sheet.rows.length)) {
    throw new RowOpError("That row no longer exists.");
  }

  let rows = sheet.rows;
  if (op.type === "update") {
    rows = rows.map((r, i) => (i === op.index ? { ...r, ...op.values } : r));
  } else if (op.type === "add") {
    const blank = Object.fromEntries(sheet.headers.map((h) => [h, null])) as Record<string, CellValue>;
    rows = [...rows, { ...blank, ...op.values }];
  } else {
    rows = rows.filter((_, i) => i !== op.index);
  }
  const sheets = source.sheets.map((s, i) => (i === sheetIdx ? { ...s, rows } : s));
  return { ...source, sheets };
}

/** Converts form text back into a cell value: blank → null, numeric text → number. */
export function coerceCellInput(text: string, previous: CellValue | undefined): CellValue {
  const t = text.trim();
  if (!t) return null;
  if (typeof previous === "string" && !/^-?\d+(\.\d+)?$/.test(previous.trim())) return t;
  const n = Number(t);
  return /^-?\d+(\.\d+)?$/.test(t) && Number.isFinite(n) ? n : t;
}
