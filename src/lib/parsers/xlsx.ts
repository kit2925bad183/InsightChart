import * as XLSX from "xlsx";
import type { DataSheet, ParsedSource } from "../types";

function sheetFromWorksheet(id: string, name: string, ws: XLSX.WorkSheet): DataSheet | null {
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

export async function parseXlsx(file: File): Promise<ParsedSource> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const warnings: string[] = [];
  const sheets: DataSheet[] = [];

  wb.SheetNames.forEach((name, i) => {
    const ws = wb.Sheets[name];
    const sheet = sheetFromWorksheet(`sheet-${i}`, name, ws);
    if (sheet) sheets.push(sheet);
    else warnings.push(`Sheet "${name}" is empty and was skipped.`);
  });

  if (!sheets.length) {
    warnings.push("No readable tabular data was found in this workbook.");
  }

  return { kind: file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx", fileName: file.name, sheets, warnings };
}

export async function parseCsv(file: File): Promise<ParsedSource> {
  const text = await file.text();
  const wb = XLSX.read(text, { type: "string" });
  const name = wb.SheetNames[0];
  const ws = wb.Sheets[name];
  const sheet = sheetFromWorksheet("sheet-0", file.name.replace(/\.csv$/i, ""), ws);
  const warnings = sheet ? [] : ["The CSV file appears to be empty or unreadable."];
  return { kind: "csv", fileName: file.name, sheets: sheet ? [sheet] : [], warnings, rawText: text.slice(0, 20000) };
}
