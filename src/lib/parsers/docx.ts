import mammoth from "mammoth";
import type { DataSheet, ParsedSource } from "../types";

function tablesFromHtml(html: string): DataSheet[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));
  const sheets: DataSheet[] = [];

  tables.forEach((table, i) => {
    const rowsEls = Array.from(table.querySelectorAll("tr"));
    if (!rowsEls.length) return;
    const grid = rowsEls.map((tr) => Array.from(tr.querySelectorAll("td,th")).map((c) => c.textContent?.trim() ?? ""));
    const headers = grid[0].map((h, idx) => h || `Column ${idx + 1}`);
    const rows = grid.slice(1).map((cells) => {
      const row: DataSheet["rows"][number] = {};
      headers.forEach((h, idx) => {
        const raw = cells[idx] ?? "";
        const n = Number(raw);
        row[h] = raw !== "" && Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(raw) ? n : raw || null;
      });
      return row;
    });
    if (rows.length) sheets.push({ id: `sheet-${i}`, name: `Table ${i + 1}`, headers, rows });
  });

  return sheets;
}

export async function parseDocx(file: File): Promise<ParsedSource> {
  const buf = await file.arrayBuffer();
  const { value: html, messages } = await mammoth.convertToHtml({ arrayBuffer: buf });
  const sheets = tablesFromHtml(html);
  const warnings = messages.filter((m) => m.type === "warning" || m.type === "error").map((m) => m.message);

  if (!sheets.length) {
    warnings.push("No tables were found in this document — displaying extracted text only.");
  }

  const text = new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
  return { kind: "docx", fileName: file.name, sheets, warnings, rawText: text.slice(0, 50000) };
}
