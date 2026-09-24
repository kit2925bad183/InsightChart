import * as XLSX from "xlsx";
import type { DataSheet } from "../types";

// Isomorphic: safe to import from both the main thread and the xlsx Web Worker —
// XLSX's parsing itself has no DOM dependency.

export function sheetFromWorksheet(id: string, name: string, ws: XLSX.WorkSheet): DataSheet | null {
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: true,
  });
  if (!json.length) return null;

  const headerSet = new Set<string>();
  json.forEach((row) => Object.keys(row).forEach((k) => headerSet.add(k)));
  const headers = Array.from(headerSet);

  const rows = json.map((row) => {
    const out: DataSheet["rows"][number] = {};
    for (const h of headers) {
      const v = row[h];
      if (v instanceof Date) {
        out[h] = v.toISOString().slice(0, 10);
      } else if (typeof v === "number" || typeof v === "string" || typeof v === "boolean" || v === null) {
        out[h] = v;
      } else {
        out[h] = v == null ? null : String(v);
      }
    }
    return out;
  });

  return { id, name, headers, rows };
}

export interface WorkbookResult {
  sheets: DataSheet[];
  warnings: string[];
}

export function parseWorkbook(data: ArrayBuffer | string, type: "array" | "string", singleSheetName?: string): WorkbookResult {
  const wb = type === "array" ? XLSX.read(data, { type: "array", cellDates: true }) : XLSX.read(data, { type: "string" });
  const warnings: string[] = [];
  const sheets: DataSheet[] = [];

  wb.SheetNames.forEach((name, i) => {
    const ws = wb.Sheets[name];
    const sheet = sheetFromWorksheet(`sheet-${i}`, singleSheetName ?? name, ws);
    if (sheet) sheets.push(sheet);
    else warnings.push(`Sheet "${name}" is empty and was skipped.`);
  });

  if (!sheets.length) {
    warnings.push("No readable tabular data was found in this file.");
  }

  return { sheets, warnings };
}
