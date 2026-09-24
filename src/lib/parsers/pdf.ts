import type { DataSheet, ParsedSource } from "../types";

interface TextItemLike {
  str: string;
  transform: number[];
}

/** Groups PDF text items into lines by y-position, then columns by x-gaps, to recover a rough table. */
function linesFromItems(items: TextItemLike[]) {
  const byY = new Map<number, TextItemLike[]>();
  for (const item of items) {
    const y = Math.round(item.transform[5]);
    const bucket = Array.from(byY.keys()).find((k) => Math.abs(k - y) <= 2);
    const key = bucket ?? y;
    if (!byY.has(key)) byY.set(key, []);
    byY.get(key)!.push(item);
  }
  const ys = Array.from(byY.keys()).sort((a, b) => b - a);
  return ys.map((y) => byY.get(y)!.sort((a, b) => a.transform[4] - b.transform[4]));
}

function lineToRow(items: TextItemLike[]): string[] {
  const cells: string[] = [];
  let current = "";
  let lastX: number | null = null;
  for (const item of items) {
    const x = item.transform[4];
    if (lastX !== null && x - lastX > 12) {
      cells.push(current.trim());
      current = "";
    }
    current += item.str;
    lastX = x + item.str.length * 5;
  }
  if (current.trim()) cells.push(current.trim());
  return cells;
}

export async function parsePdf(file: File): Promise<ParsedSource> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const warnings: string[] = [];
  let fullText = "";
  const allRows: string[][] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items as unknown as TextItemLike[];
    fullText += items.map((i) => i.str).join(" ") + "\n";
    const lines = linesFromItems(items);
    for (const line of lines) {
      const row = lineToRow(line);
      if (row.length > 1) allRows.push(row);
    }
  }

  const sheets: DataSheet[] = [];
  const widths = new Map<number, number>();
  allRows.forEach((r) => widths.set(r.length, (widths.get(r.length) ?? 0) + 1));
  const commonWidth = Array.from(widths.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];

  if (commonWidth && commonWidth > 1) {
    const candidateRows = allRows.filter((r) => r.length === commonWidth);
    const headers = candidateRows[0].map((h, i) => h || `Column ${i + 1}`);
    const rows = candidateRows.slice(1).map((cells) => {
      const row: DataSheet["rows"][number] = {};
      headers.forEach((h, i) => {
        const raw = cells[i] ?? "";
        const n = Number(raw);
        row[h] = raw !== "" && Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(raw) ? n : raw || null;
      });
      return row;
    });
    if (rows.length) {
      sheets.push({ id: "sheet-0", name: "Extracted table", headers, rows });
    }
  }

  if (!sheets.length) {
    warnings.push("Could not detect a consistent table grid in this PDF — showing extracted text only. Excel/CSV gives the most reliable results.");
  }

  return { kind: "pdf", fileName: file.name, sheets, warnings, rawText: fullText.slice(0, 50000) };
}
