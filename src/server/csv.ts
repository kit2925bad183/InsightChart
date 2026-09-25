import type { CellValue } from "@/lib/types";

// Cells starting with these are executed as formulas by Excel/Sheets — neutralise them
// so a crafted student name can't run a formula on whoever opens the export.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function cell(v: CellValue | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v === "string" && FORMULA_PREFIX.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Record<string, CellValue>[]): string {
  const lines = [headers.map((h) => cell(h)).join(",")];
  for (const r of rows) lines.push(headers.map((h) => cell(r[h])).join(","));
  // BOM so Excel opens UTF-8 names correctly.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
