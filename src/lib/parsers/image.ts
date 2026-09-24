import type { DataSheet, ParsedSource } from "../types";

/** Heuristic: OCR text lines, split on 2+ spaces (common table alignment). */
function linesToSheet(text: string, name: string): DataSheet | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const split = (l: string) => l.split(/ {2,}|\t/).map((c) => c.trim()).filter((c) => c !== "");
  const headers = split(lines[0]);
  if (headers.length < 2) return null;

  const rows = lines.slice(1).map((line) => {
    const cells = split(line);
    const row: DataSheet["rows"][number] = {};
    headers.forEach((h, i) => {
      const raw = cells[i] ?? "";
      const n = Number(raw);
      row[h] = raw !== "" && Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(raw) ? n : raw || null;
    });
    return row;
  });

  return { id: "sheet-0", name, headers, rows };
}

export async function parseImage(file: File): Promise<ParsedSource> {
  const warnings: string[] = [
    "Image OCR is experimental: table structure is guessed from spacing and may need manual correction. Excel/CSV/PDF give more reliable results.",
  ];

  try {
    const Tesseract = await import("tesseract.js");
    // Self-hosted (public/tesseract/) instead of the tesseract.js/jsdelivr CDN defaults,
    // so OCR doesn't silently depend on a third-party CDN being reachable at runtime.
    const { data } = await Tesseract.recognize(file, "eng", {
      workerPath: "/tesseract/worker.min.js",
      corePath: "/tesseract",
      langPath: "/tesseract",
    });
    const text = data.text ?? "";
    const sheet = linesToSheet(text, file.name);
    const sheets = sheet ? [sheet] : [];
    if (!sheet) {
      warnings.push("No table-like structure could be recovered from this image's text.");
    }
    return { kind: "image", fileName: file.name, sheets, warnings, rawText: text.slice(0, 20000) };
  } catch {
    return {
      kind: "image",
      fileName: file.name,
      sheets: [],
      warnings: ["Could not run OCR on this image in the browser. Try a clearer image, or export the table as Excel/CSV/PDF instead."],
    };
  }
}
