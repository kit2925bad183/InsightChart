import type { DataSheet, ParsedSource } from "../types";

/** Heuristic tabular parse: tries tab, then comma, then 2+ spaces as the delimiter. */
function splitLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes(",")) return line.split(",");
  return line.split(/ {2,}/);
}

export async function parseTxt(file: File): Promise<ParsedSource> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const warnings: string[] = [];
  const sheets: DataSheet[] = [];

  if (lines.length >= 2) {
    const headers = splitLine(lines[0]).map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const cells = splitLine(line);
      const row: DataSheet["rows"][number] = {};
      headers.forEach((h, i) => {
        const raw = (cells[i] ?? "").trim();
        const n = Number(raw);
        row[h] = raw === "" ? null : Number.isFinite(n) && raw !== "" && /^-?\d+(\.\d+)?$/.test(raw) ? n : raw;
      });
      return row;
    });
    if (headers.length > 1) {
      sheets.push({ id: "sheet-0", name: file.name, headers, rows });
    } else {
      warnings.push("Could not detect a consistent column delimiter (tab, comma, or aligned spaces) — showing raw text only.");
    }
  } else {
    warnings.push("File has too few lines to infer a table structure.");
  }

  return { kind: "txt", fileName: file.name, sheets, warnings, rawText: text.slice(0, 50000) };
}
