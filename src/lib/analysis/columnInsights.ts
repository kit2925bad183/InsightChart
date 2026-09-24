import type { DataSheet } from "../types";

export interface ColumnInsight {
  key: string;
  isNumeric: boolean;
  responseCount: number;
  // numeric
  min?: number;
  max?: number;
  avg?: number;
  // categorical
  topAnswers?: { value: string; count: number; pct: number }[];
  distinctCount?: number;
}

/** Quick per-column stats for any column not already used as score/name/department/etc —
 * typically individual question columns. No answer key exists in this data shape, so this
 * surfaces answer *patterns* (distribution, most-common response) rather than a fabricated
 * correctness/"right answer rate" metric. */
export function analyzeColumn(sheet: DataSheet, key: string): ColumnInsight | null {
  const values = sheet.rows.map((r) => r[key]).filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
  if (!values.length) return null;

  const numbers = values.map((v) => (typeof v === "number" ? v : Number(v))).filter((n) => Number.isFinite(n));
  const isNumeric = numbers.length === values.length;

  if (isNumeric) {
    return {
      key,
      isNumeric: true,
      responseCount: values.length,
      min: Math.min(...numbers),
      max: Math.max(...numbers),
      avg: Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 10) / 10,
    };
  }

  const counts = new Map<string, number>();
  for (const v of values) {
    const s = String(v).trim();
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const topAnswers = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([value, count]) => ({ value, count, pct: Math.round((count / values.length) * 100) }));

  return {
    key,
    isNumeric: false,
    responseCount: values.length,
    topAnswers,
    distinctCount: counts.size,
  };
}
