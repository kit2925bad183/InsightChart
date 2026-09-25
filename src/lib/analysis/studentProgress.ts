// Follows one student across several assessment files: finds them in each file (by
// register number first, then by name), and summarises their score against the class.

import { mean, round1, type StudentRecord } from "./stats";

export interface StudentRef {
  name: string;
  registration: string;
}

export interface AssessmentInput {
  id: string;
  label: string;
  records: StudentRecord[];
  /** When the assessment was held (yyyy-mm-dd), or "" when unknown. */
  date?: string;
}

export interface ProgressRow {
  id: string;
  label: string;
  /** null when the student isn't in this file (or can't be told apart from a namesake). */
  score: number | null;
  classAverage: number;
  /** Highest score in the class. */
  classTop: number;
  classSize: number;
  date: string;
  /** 1 = top of the class (ties share a rank). */
  rank: number | null;
  matchedBy: "registration" | "name" | null;
  /** More than one student in this file has this name and no register number matched. */
  ambiguous: boolean;
  /** Difference from the previous assessment the student appears in. */
  change: number | null;
}

/** Compares identifiers ignoring case, spaces and punctuation ("21 cs-001" = "21CS001"). */
export function normalizeKey(value: string): string {
  return value.normalize("NFKD").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const isBlank = (v: string | undefined) => !v || v.trim() === "" || v.trim() === "—";

export function findStudent(
  records: StudentRecord[],
  ref: StudentRef
): { record: StudentRecord; matchedBy: "registration" | "name" } | { ambiguous: true } | null {
  if (!isBlank(ref.registration)) {
    const key = normalizeKey(ref.registration);
    const byReg = records.find((r) => !isBlank(r.registration) && normalizeKey(r.registration) === key);
    if (byReg) return { record: byReg, matchedBy: "registration" };
  }
  if (!isBlank(ref.name)) {
    const key = normalizeKey(ref.name);
    const byName = records.filter((r) => !isBlank(r.name) && normalizeKey(r.name) === key);
    if (byName.length === 1) return { record: byName[0], matchedBy: "name" };
    if (byName.length > 1) return { ambiguous: true };
  }
  return null;
}

export function buildStudentProgress(ref: StudentRef, assessments: AssessmentInput[]): ProgressRow[] {
  let previous: number | null = null;
  return assessments.map((a) => {
    const scores = a.records.map((r) => r.score);
    const found = findStudent(a.records, ref);
    const record = found && "record" in found ? found.record : null;
    const score = record ? record.score : null;
    const change: number | null = score !== null && previous !== null ? round1(score - previous) : null;
    if (score !== null) previous = score;
    return {
      id: a.id,
      label: a.label,
      date: a.date ?? "",
      score,
      classAverage: scores.length ? round1(mean(scores)) : 0,
      classTop: scores.length ? Math.max(...scores) : 0,
      classSize: scores.length,
      rank: score === null ? null : 1 + scores.filter((s) => s > score).length,
      matchedBy: record && found && "matchedBy" in found ? found.matchedBy : null,
      ambiguous: !!found && "ambiguous" in found,
      change,
    };
  });
}

/** Name or register-number search for the picker; one entry per student. */
export function searchStudents(records: StudentRecord[], query: string, limit = 20): StudentRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qKey = normalizeKey(query);
  const seen = new Set<string>();
  const out: StudentRecord[] = [];
  for (const r of records) {
    const nameHit = r.name.toLowerCase().includes(q);
    const regHit = !!qKey && !isBlank(r.registration) && normalizeKey(r.registration).includes(qKey);
    if (!nameHit && !regHit) continue;
    const id = isBlank(r.registration) ? `n:${normalizeKey(r.name)}` : `r:${normalizeKey(r.registration)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

// ---- Comparing test-wise, day-wise, week-wise or month-wise ----

export type CompareBy = "test" | "day" | "week" | "month";

export const COMPARE_BY_LABELS: Record<CompareBy, string> = { test: "Test-wise", day: "Day-wise", week: "Week-wise", month: "Month-wise" };

export interface PeriodRow extends ProgressRow {
  /** The assessments folded into this point (one for test-wise). */
  tests: string[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseIso(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null;
}

const toIso = (d: Date) => d.toISOString().slice(0, 10);

export function formatDay(date: string): string {
  const d = parseIso(date);
  return d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : date;
}

/** Period key + axis label for a date. Weeks start on Monday. */
function periodOf(date: string, by: Exclude<CompareBy, "test">): { key: string; label: string } | null {
  const d = parseIso(date);
  if (!d) return null;
  if (by === "day") return { key: date, label: formatDay(date) };
  if (by === "month") return { key: date.slice(0, 7), label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return { key: toIso(monday), label: `Week of ${formatDay(toIso(monday))}` };
}

/**
 * Folds per-test rows into one point per test / day / week / month. In a period with several
 * tests the student's score and the class average are averaged, the class top is the highest.
 * Date-wise views leave out tests without a date — those are returned in `undated`.
 */
export function groupProgress(rows: ProgressRow[], by: CompareBy): { rows: PeriodRow[]; undated: string[] } {
  if (by === "test") return { rows: rows.map((r) => ({ ...r, tests: [r.label] })), undated: [] };

  const undated: string[] = [];
  const groups = new Map<string, { label: string; rows: ProgressRow[] }>();
  for (const r of rows) {
    const p = periodOf(r.date, by);
    if (!p) {
      undated.push(r.label);
      continue;
    }
    const g = groups.get(p.key) ?? { label: p.label, rows: [] };
    g.rows.push(r);
    groups.set(p.key, g);
  }

  let previous: number | null = null;
  const out = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, g]): PeriodRow => {
      const scored = g.rows.filter((r) => r.score !== null);
      const single = g.rows.length === 1 ? g.rows[0] : null;
      const score = scored.length ? round1(mean(scored.map((r) => r.score!))) : null;
      const change = score !== null && previous !== null ? round1(score - previous) : null;
      if (score !== null) previous = score;
      return {
        id: key,
        label: g.label,
        date: key,
        score,
        classAverage: round1(mean(g.rows.map((r) => r.classAverage))),
        classTop: Math.max(...g.rows.map((r) => r.classTop)),
        classSize: Math.max(...g.rows.map((r) => r.classSize)),
        rank: single ? single.rank : null,
        matchedBy: single ? single.matchedBy : (scored[0]?.matchedBy ?? null),
        ambiguous: !scored.length && g.rows.some((r) => r.ambiguous),
        change,
        tests: g.rows.map((r) => r.label),
      };
    });
  return { rows: out, undated };
}

/** Reads a date out of a file name, e.g. "Test 1 2026-09-12.xlsx" or "CAT_12.09.2026.csv".
 * Numeric dates are taken as day-month-year unless they start with the year. */
export function dateFromFileName(fileName: string): string {
  const s = fileName.replace(/\.[a-z0-9]+$/i, "");
  const valid = (y: number, m: number, d: number) => {
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return parseIso(iso) ? iso : "";
  };
  let m = /(?<!\d)(\d{4})[-_./](\d{1,2})[-_./](\d{1,2})(?!\d)/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /(?<!\d)(\d{1,2})[-_./](\d{1,2})[-_./](\d{4}|\d{2})(?!\d)/.exec(s);
  if (m) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = /(?<!\d)(\d{1,2})(?:st|nd|rd|th)?[\s_-]*([a-z]{3})[a-z]*[\s_,-]*(\d{4})(?!\d)/i.exec(s);
  if (m) {
    const month = MONTHS.findIndex((x) => x.toLowerCase() === m![2].toLowerCase());
    if (month >= 0) return valid(+m[3], month + 1, +m[1]);
  }
  m = /(?<![a-z])([a-z]{3})[a-z]*[\s_-]*(\d{1,2})(?:st|nd|rd|th)?[\s_,-]+(\d{4})(?!\d)/i.exec(s);
  if (m) {
    const month = MONTHS.findIndex((x) => x.toLowerCase() === m![1].toLowerCase());
    if (month >= 0) return valid(+m[3], month + 1, +m[2]);
  }
  return "";
}
