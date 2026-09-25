// Filters built from the uploaded file itself: every column becomes a filter whose kind
// depends on what the column holds — a tick-list for departments and other categories,
// a from–to range for register numbers, min–max for scores, dates for date columns and
// "contains" search for free text.

import type { CellValue, ColumnMapping, ColumnProfile, ColumnRole, DataSheet } from "../types";
import { resolveDepartment } from "./normalizeDepartment";

export type FieldKind = "choice" | "text" | "number" | "date";

export interface FilterField {
  key: string;
  label: string;
  kind: FieldKind;
  role: ColumnRole;
  /** Register-number columns also get a from–to range. */
  range: boolean;
  /** Smallest/largest value in the data, for number and date fields (dates as yyyy-mm-dd). */
  min?: number | string;
  max?: number | string;
}

export type FieldFilter =
  | { kind: "choice"; values: string[] }
  | { kind: "text"; contains: string; from: string; to: string }
  | { kind: "number"; min: string; max: string }
  | { kind: "date"; from: string; to: string };

export type Filters = Record<string, FieldFilter>;

export interface FilterOptions {
  /** Department column to show with the same cleaned-up names as the rest of the app. */
  departmentKey?: string;
  normalizeDepartments?: boolean;
  departmentOverrides?: Record<string, string>;
}

/** Columns with at most this many different values get a tick-list. */
const MAX_CHOICES = 60;

const ROLE_ORDER: ColumnRole[] = ["registration", "name", "department", "subject", "status", "category", "score", "numeric", "date", "unknown"];

const isBlank = (v: CellValue | undefined) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

// ─── Reading cell values ────────────────────────────────────────────────────

/** The text a cell is filtered and grouped by (departments cleaned up like everywhere else). */
export function cellText(row: DataSheet["rows"][number], key: string, opts: FilterOptions = {}): string {
  const v = row[key];
  if (isBlank(v)) return "";
  const text = String(v).trim();
  if (key === opts.departmentKey && opts.normalizeDepartments !== false) return resolveDepartment(text, opts.departmentOverrides ?? {});
  return text;
}

function cellNumber(v: CellValue | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/%/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** yyyy-mm-dd for "2026-09-12", "12/09/2026", "12-09-26" (day first) or a spreadsheet date number. */
export function cellDate(v: CellValue | undefined): string | null {
  if (isBlank(v)) return null;
  const valid = (y: number, m: number, d: number) => {
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date.toISOString().slice(0, 10) : null;
  };
  if (typeof v === "number") {
    // Excel serial day numbers (1900 system) for plausible years.
    if (v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
    return null;
  }
  const s = String(v).trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/.exec(s);
  if (m) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  return null;
}

/** Register numbers compared ignoring case, spaces and punctuation, with digit runs as numbers. */
export function compareRegister(a: string, b: string): number {
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return norm(a).localeCompare(norm(b), "en", { numeric: true });
}

// ─── Building the fields ────────────────────────────────────────────────────

export function buildFilterFields(sheet: DataSheet, columns: ColumnProfile[], mapping: ColumnMapping = {}): FilterField[] {
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const fields: FilterField[] = [];
  for (const key of sheet.headers) {
    const col = byKey.get(key);
    const values = sheet.rows.map((r) => r[key]).filter((v) => !isBlank(v));
    if (!values.length) continue;
    const role: ColumnRole =
      key === mapping.registration ? "registration" : key === mapping.studentName ? "name" : key === mapping.department ? "department" : key === mapping.numeric ? "score" : (col?.role ?? "unknown");
    const distinct = new Set(values.map((v) => String(v).trim())).size;
    const numbers = values.map(cellNumber).filter((n): n is number => n !== null);
    const dates = values.map(cellDate).filter((d): d is string => d !== null);
    const allNumeric = numbers.length === values.length;
    const allDates = !allNumeric && dates.length === values.length;

    let kind: FieldKind;
    if (role === "registration" || role === "name") kind = "text";
    else if (role === "date" && dates.length === values.length) kind = "date";
    else if (allDates) kind = "date";
    else if (role === "department" || role === "subject" || role === "status") kind = distinct <= MAX_CHOICES * 3 ? "choice" : "text";
    // Marks are always a range; other number columns with only a few values (semester,
    // year) are more useful as a tick-list.
    else if (allNumeric && (role === "score" || distinct > 12)) kind = "number";
    // A tick-list only helps when values repeat; near-unique free text gets a search box.
    else if (distinct <= MAX_CHOICES && (distinct <= 8 || distinct <= values.length / 2)) kind = "choice";
    else if (allNumeric) kind = "number";
    else kind = "text";

    const field: FilterField = { key, label: key, kind, role, range: role === "registration" };
    if (kind === "number") {
      field.min = Math.min(...numbers);
      field.max = Math.max(...numbers);
    } else if (kind === "date") {
      const sorted = [...dates].sort();
      field.min = sorted[0];
      field.max = sorted[sorted.length - 1];
    }
    fields.push(field);
  }
  // Identity first, then groupings, numbers and dates; other free-text columns last.
  const rank = (f: FilterField) => {
    if (f.kind === "text" && f.role !== "registration" && f.role !== "name") return ROLE_ORDER.length;
    const i = ROLE_ORDER.indexOf(f.role);
    return i === -1 ? ROLE_ORDER.length : i;
  };
  return fields.map((f, i) => ({ f, i })).sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i).map(({ f }) => f);
}

export function emptyFilter(field: FilterField): FieldFilter {
  switch (field.kind) {
    case "choice":
      return { kind: "choice", values: [] };
    case "text":
      return { kind: "text", contains: "", from: "", to: "" };
    case "number":
      return { kind: "number", min: "", max: "" };
    case "date":
      return { kind: "date", from: "", to: "" };
  }
}

export function isActive(f: FieldFilter | undefined): boolean {
  if (!f) return false;
  switch (f.kind) {
    case "choice":
      return f.values.length > 0;
    case "text":
      return !!(f.contains.trim() || f.from.trim() || f.to.trim());
    case "number":
      return f.min.trim() !== "" || f.max.trim() !== "";
    case "date":
      return !!(f.from || f.to);
  }
}

// ─── Applying them ──────────────────────────────────────────────────────────

/** Case-insensitive "contains"; also ignores spaces and punctuation, so "21cs0" finds "21 CS-001". */
function containsLoosely(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  const strip = (s: string) => s.replace(/[^a-z0-9]/g, "");
  return strip(q) !== "" && strip(t).includes(strip(q));
}

function matches(row: DataSheet["rows"][number], key: string, f: FieldFilter, opts: FilterOptions): boolean {
  switch (f.kind) {
    case "choice":
      return !f.values.length || f.values.includes(cellText(row, key, opts));
    case "text": {
      const text = cellText(row, key, opts);
      if (!containsLoosely(text, f.contains)) return false;
      if (f.from.trim() && (!text || compareRegister(text, f.from.trim()) < 0)) return false;
      if (f.to.trim() && (!text || compareRegister(text, f.to.trim()) > 0)) return false;
      return true;
    }
    case "number": {
      const min = f.min.trim() === "" ? null : Number(f.min);
      const max = f.max.trim() === "" ? null : Number(f.max);
      if (min === null && max === null) return true;
      const n = cellNumber(row[key]);
      if (n === null) return false;
      return (min === null || !Number.isFinite(min) || n >= min) && (max === null || !Number.isFinite(max) || n <= max);
    }
    case "date": {
      if (!f.from && !f.to) return true;
      const d = cellDate(row[key]);
      if (!d) return false;
      return (!f.from || d >= f.from) && (!f.to || d <= f.to);
    }
  }
}

function matchesSearch(row: DataSheet["rows"][number], headers: string[], search: string, opts: FilterOptions) {
  const q = search.trim().toLowerCase();
  return !q || headers.some((h) => cellText(row, h, opts).toLowerCase().includes(q));
}

/** Rows passing every active filter and the free-text search. `except` skips one field
 * (used to count what each tick-box option would give with the other filters applied). */
export function applyFilters(sheet: DataSheet, filters: Filters, search = "", opts: FilterOptions = {}, except?: string): DataSheet["rows"] {
  const active = Object.entries(filters).filter(([k, f]) => k !== except && isActive(f));
  return sheet.rows.filter((row) => matchesSearch(row, sheet.headers, search, opts) && active.every(([k, f]) => matches(row, k, f, opts)));
}

/** Tick-box options for a choice field with how many rows each would match, given the other filters. */
export function choiceCounts(sheet: DataSheet, field: FilterField, filters: Filters, search = "", opts: FilterOptions = {}): { value: string; count: number }[] {
  const all = new Map<string, number>();
  for (const row of sheet.rows) {
    const v = cellText(row, field.key, opts);
    if (v) all.set(v, 0);
  }
  for (const row of applyFilters(sheet, filters, search, opts, field.key)) {
    const v = cellText(row, field.key, opts);
    if (v) all.set(v, (all.get(v) ?? 0) + 1);
  }
  return [...all.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, "en", { numeric: true }));
}

/** Short human description of an active filter, for the chips above the results. */
export function describeFilter(field: FilterField, f: FieldFilter): string {
  switch (f.kind) {
    case "choice":
      return `${field.label}: ${f.values.length <= 3 ? f.values.join(", ") : `${f.values.slice(0, 2).join(", ")} +${f.values.length - 2}`}`;
    case "text": {
      const parts = [];
      if (f.contains.trim()) parts.push(`contains “${f.contains.trim()}”`);
      if (f.from.trim() && f.to.trim()) parts.push(`${f.from.trim()} – ${f.to.trim()}`);
      else if (f.from.trim()) parts.push(`from ${f.from.trim()}`);
      else if (f.to.trim()) parts.push(`up to ${f.to.trim()}`);
      return `${field.label}: ${parts.join(", ")}`;
    }
    case "number":
      if (f.min.trim() && f.max.trim()) return `${field.label}: ${f.min} – ${f.max}`;
      return `${field.label}: ${f.min.trim() ? `≥ ${f.min}` : `≤ ${f.max}`}`;
    case "date":
      if (f.from && f.to) return `${field.label}: ${f.from} – ${f.to}`;
      return `${field.label}: ${f.from ? `from ${f.from}` : `until ${f.to}`}`;
  }
}
