import type { ParsedSource } from "../types";
// Each format's reader is loaded only when a file of that type is picked: the Excel,
// Word, PDF and OCR libraries are large, and most visits (and every view-only role)
// never upload anything.

export const SUPPORTED_EXTENSIONS = [".xlsx", ".xls", ".csv", ".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".webp"];

// xlsx/csv parse off the main thread (see runInWorker.ts), so they can comfortably
// handle larger files than the still-synchronous pdf/docx/image/txt parsers.
const HARD_MAX_BYTES = 50 * 1024 * 1024; // 50MB — reject outright, any format
const MAIN_THREAD_WARN_BYTES = 5 * 1024 * 1024; // 5MB — parses, but warns it may be slow

function formatMb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export async function parseFile(file: File): Promise<ParsedSource> {
  const name = file.name.toLowerCase();

  if (file.size > HARD_MAX_BYTES) {
    return {
      kind: "txt",
      fileName: file.name,
      sheets: [],
      warnings: [`This file is ${formatMb(file.size)}, which is over the ${formatMb(HARD_MAX_BYTES)} limit. Try a smaller export, or split it into multiple files.`],
    };
  }

  const isMainThreadFormat = !name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv");
  const sizeWarning =
    isMainThreadFormat && file.size > MAIN_THREAD_WARN_BYTES
      ? [`This is a large file (${formatMb(file.size)}) — parsing may take a moment and the page may be briefly unresponsive.`]
      : [];

  try {
    let result: ParsedSource;
    if (name.endsWith(".csv")) result = await (await import("./xlsx")).parseCsv(file);
    else if (name.endsWith(".xlsx") || name.endsWith(".xls")) result = await (await import("./xlsx")).parseXlsx(file);
    else if (name.endsWith(".docx")) result = await (await import("./docx")).parseDocx(file);
    else if (name.endsWith(".pdf")) result = await (await import("./pdf")).parsePdf(file);
    else if (name.endsWith(".txt")) result = await (await import("./txt")).parseTxt(file);
    else if (/\.(png|jpe?g|webp|gif|bmp)$/.test(name)) result = await (await import("./image")).parseImage(file);
    else
      return {
        kind: "txt",
        fileName: file.name,
        sheets: [],
        warnings: [`Unsupported file type "${file.name.split(".").pop()}". Supported formats: Excel, CSV, PDF, Word, TXT, and common image formats.`],
      };

    return { ...result, warnings: [...sizeWarning, ...result.warnings] };
  } catch (err) {
    return {
      kind: "txt",
      fileName: file.name,
      sheets: [],
      warnings: [`Could not read this file: ${err instanceof Error ? err.message : "unknown error"}.`],
    };
  }
}
