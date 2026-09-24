import type { CellValue, DataSheet } from "../types";
import { canonicalDepartmentLabel } from "./normalizeDepartment";

export interface StudentRecord {
  row: DataSheet["rows"][number];
  name: string;
  registration: string;
  department: string;
  score: number;
}

export function toStudentRecords(
  sheet: DataSheet,
  mapping: { studentName?: string; registration?: string; department?: string; numeric?: string },
  normalizeDepartments = true
): StudentRecord[] {
  const { studentName, registration, department, numeric } = mapping;
  if (!numeric) return [];
  return sheet.rows
    .map((row) => {
      const raw = row[numeric];
      const score = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(score)) return null;
      const rawDept = department ? String(row[department] ?? "—") : "—";
      return {
        row,
        name: studentName ? String(row[studentName] ?? "—") : "—",
        registration: registration ? String(row[registration] ?? "—") : "—",
        department: department && normalizeDepartments ? canonicalDepartmentLabel(rawDept) : rawDept,
        score,
      };
    })
    .filter((r): r is StudentRecord => r !== null);
}

export function mean(nums: number[]) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function fmt(v: CellValue): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}
