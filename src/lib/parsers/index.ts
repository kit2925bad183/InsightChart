import type { ParsedSource } from "../types";
import { parseXlsx, parseCsv } from "./xlsx";
import { parseTxt } from "./txt";
import { parseDocx } from "./docx";
import { parsePdf } from "./pdf";
import { parseImage } from "./image";

export const SUPPORTED_EXTENSIONS = [".xlsx", ".xls", ".csv", ".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".webp"];

export async function parseFile(file: File): Promise<ParsedSource> {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith(".csv")) return await parseCsv(file);
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) return await parseXlsx(file);
    if (name.endsWith(".docx")) return await parseDocx(file);
    if (name.endsWith(".pdf")) return await parsePdf(file);
    if (name.endsWith(".txt")) return await parseTxt(file);
    if (/\.(png|jpe?g|webp|gif|bmp)$/.test(name)) return await parseImage(file);

    return {
      kind: "txt",
      fileName: file.name,
      sheets: [],
      warnings: [`Unsupported file type "${file.name.split(".").pop()}". Supported formats: Excel, CSV, PDF, Word, TXT, and common image formats.`],
    };
  } catch (err) {
    return {
      kind: "txt",
      fileName: file.name,
      sheets: [],
      warnings: [`Could not read this file: ${err instanceof Error ? err.message : "unknown error"}.`],
    };
  }
}
