import type { CellValue, ColumnProfile, ColumnRole, DataSheet } from "../types";

const SCORE_WORDS = /\b(score|marks?|mark|percentage|percent|%|grade|points?|result)\b/i;
const NAME_WORDS = /\b(name|student|candidate|employee)\b/i;
const REG_WORDS = /\b(reg(istration)?|roll|id|enrollment|enrolment|number)\b/i;
const DEPT_WORDS = /\b(department|dept|branch|team|group|division|course|class|section)\b/i;
const DATE_WORDS = /\b(date|day|timestamp|time)\b/i;
const STATUS_WORDS = /\b(status|result|outcome|qualif)\b/i;

function isBlank(v: CellValue) {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

function toNumber(v: CellValue): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/%/g, "").trim();
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function looksLikeDate(v: CellValue): boolean {
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return true;
    if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(v)) return true;
  }
  return false;
}

export function inferColumns(sheet: DataSheet): ColumnProfile[] {
  return sheet.headers.map((key) => {
    const values = sheet.rows.map((r) => r[key]).filter((v) => !isBlank(v));
    const numbers = values.map(toNumber).filter((n): n is number => n !== null);
    const isNumeric = values.length > 0 && numbers.length === values.length;
    const isDate = !isNumeric && values.length > 0 && values.every(looksLikeDate);
    const distinctCount = new Set(values.map((v) => String(v))).size;

    let role: ColumnRole = "unknown";
    let scoreConfidence = 0;

    if (REG_WORDS.test(key)) {
      role = "registration";
    } else if (NAME_WORDS.test(key) && !isNumeric) {
      role = "name";
    } else if (DATE_WORDS.test(key) || isDate) {
      role = "date";
    } else if (DEPT_WORDS.test(key) && !isNumeric) {
      role = "department";
    } else if (STATUS_WORDS.test(key) && !isNumeric) {
      role = "status";
    } else if (isNumeric && SCORE_WORDS.test(key)) {
      role = "score";
      scoreConfidence = 0.9;
    } else if (isNumeric) {
      role = "numeric";
      scoreConfidence = SCORE_WORDS.test(key) ? 0.6 : 0.2;
    } else if (!isNumeric && distinctCount > 0 && distinctCount <= Math.max(20, sheet.rows.length * 0.5)) {
      role = "category";
    }

    const profile: ColumnProfile = {
      key,
      role,
      isNumeric,
      isDate,
      distinctCount,
      sampleValues: values.slice(0, 5),
      scoreConfidence,
    };
    if (isNumeric && numbers.length) {
      profile.min = Math.min(...numbers);
      profile.max = Math.max(...numbers);
    }
    return profile;
  });
}

/** Pick the best "Score" column: exact keyword match wins, else highest-variance numeric column. */
export function detectScoreColumn(sheet: DataSheet, columns: ColumnProfile[]): string | null {
  const named = columns.find((c) => c.role === "score");
  if (named) return named.key;

  const numericCols = columns.filter((c) => c.isNumeric && c.role !== "registration");
  if (!numericCols.length) return null;

  let best: { key: string; variance: number } | null = null;
  for (const col of numericCols) {
    const nums = sheet.rows
      .map((r) => r[col.key])
      .filter((v): v is number => typeof v === "number");
    if (!nums.length) continue;
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
    if (!best || variance > best.variance) best = { key: col.key, variance };
  }
  return best?.key ?? numericCols[0].key;
}

export function detectMapping(sheet: DataSheet, columns: ColumnProfile[]) {
  const score = detectScoreColumn(sheet, columns);
  const name = columns.find((c) => c.role === "name")?.key;
  const registration = columns.find((c) => c.role === "registration")?.key;
  const department = columns.find((c) => c.role === "department")?.key;
  const dateColumn = columns.find((c) => c.role === "date")?.key;
  const category = department ?? columns.find((c) => c.role === "category")?.key;

  return {
    category,
    numeric: score ?? undefined,
    studentName: name,
    registration,
    department,
    dateColumn,
  };
}
