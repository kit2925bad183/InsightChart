import type { ParsedSource } from "../types";
import { parseWorkbookOffMainThread } from "./runInWorker";

export async function parseXlsx(file: File): Promise<ParsedSource> {
  const buf = await file.arrayBuffer();
  const { sheets, warnings } = await parseWorkbookOffMainThread(buf, "array");
  return { kind: file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx", fileName: file.name, sheets, warnings };
}

export async function parseCsv(file: File): Promise<ParsedSource> {
  const text = await file.text();
  const { sheets, warnings } = await parseWorkbookOffMainThread(text, "string", file.name.replace(/\.csv$/i, ""));
  return { kind: "csv", fileName: file.name, sheets, warnings, rawText: text.slice(0, 20000) };
}
