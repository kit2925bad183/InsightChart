/** Turns an uploaded file name into a short "<part> / <part>" report subtitle, e.g.
 * "Placement Mock Assessment 1 - Aptitude & Reasoning (Responses).xlsx" -> "Placement Mock Assessment 1 / Aptitude & Reasoning". */
export function deriveAssessmentTitle(fileName: string): string {
  const noExt = fileName.replace(/\.[a-z0-9]+$/i, "");
  const noParens = noExt.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const parts = noParens
    .split(/\s+-\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts.join(" / ") : noParens;
}
