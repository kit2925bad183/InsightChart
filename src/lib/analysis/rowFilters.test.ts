import { describe, expect, it } from "vitest";
import { applyFilters, buildFilterFields, cellDate, choiceCounts, compareRegister, describeFilter, emptyFilter, type Filters } from "./rowFilters";
import { inferColumns, detectMapping } from "./inferColumns";
import type { DataSheet } from "../types";

const sheet: DataSheet = {
  id: "s1",
  name: "Sheet1",
  headers: ["Name", "Register Number", "Department", "Section", "Score", "Exam Date", "Remarks"],
  rows: [
    { Name: "Asha", "Register Number": "21CS001", Department: "cse", Section: "A", Score: 78, "Exam Date": "2026-09-07", Remarks: "Good" },
    { Name: "Bala", "Register Number": "21CS009", Department: "CSE", Section: "B", Score: 42, "Exam Date": "08/09/2026", Remarks: "" },
    { Name: "Chitra", "Register Number": "21CS010", Department: "ECE", Section: "A", Score: 91, "Exam Date": "2026-09-10", Remarks: "Excellent" },
    { Name: "Dinesh", "Register Number": "21 CS 025", Department: "ece", Section: "B", Score: 55, "Exam Date": "2026-09-12", Remarks: "Needs practice" },
    { Name: "Esther", "Register Number": "21CS100", Department: "MECH", Section: "A", Score: 67, "Exam Date": "2026-09-15", Remarks: "Improving" },
    { Name: "Farhan", "Register Number": "21CS101", Department: "Mechanical", Section: "B", Score: 30, "Exam Date": "2026-09-20", Remarks: "Absent once" },
    { Name: "Gita", "Register Number": "21CS102", Department: "CSE", Section: "A", Score: 88, "Exam Date": "2026-09-21", Remarks: "Consistent" },
    { Name: "Hari", "Register Number": "21CS103", Department: "ECE", Section: "B", Score: 61, "Exam Date": "2026-09-22", Remarks: "Steady" },
    { Name: "Indu", "Register Number": "21CS104", Department: "CSE", Section: "A", Score: 73, "Exam Date": "2026-09-23", Remarks: "Good work" },
    { Name: "Jai", "Register Number": "21CS105", Department: "MECH", Section: "B", Score: 49, "Exam Date": "2026-09-24", Remarks: "Can improve" },
    { Name: "Kavi", "Register Number": "21CS106", Department: "ECE", Section: "A", Score: 95, "Exam Date": "2026-09-25", Remarks: "Top" },
    { Name: "Latha", "Register Number": "21CS107", Department: "CSE", Section: "B", Score: 58, "Exam Date": "2026-09-26", Remarks: "Average" },
    { Name: "Mani", "Register Number": "21CS108", Department: "MECH", Section: "A", Score: 64, "Exam Date": "2026-09-27", Remarks: "Fair" },
  ],
};
const columns = inferColumns(sheet);
const mapping = detectMapping(sheet, columns);
const fields = buildFilterFields(sheet, columns, mapping);
const opts = { departmentKey: mapping.department, normalizeDepartments: true };
const field = (key: string) => fields.find((f) => f.key === key)!;
const names = (rows: DataSheet["rows"]) => rows.map((r) => r.Name);
const blank = (): Filters => Object.fromEntries(fields.map((f) => [f.key, emptyFilter(f)]));

describe("filters built from the uploaded columns", () => {
  it("picks a sensible filter for each column, register number first", () => {
    expect(fields.map((f) => [f.key, f.kind])).toEqual([
      ["Register Number", "text"],
      ["Name", "text"],
      ["Department", "choice"],
      ["Section", "choice"],
      ["Score", "number"],
      ["Exam Date", "date"],
      ["Remarks", "text"],
    ]);
    expect(field("Register Number").range).toBe(true);
    expect([field("Score").min, field("Score").max]).toEqual([30, 95]);
    expect([field("Exam Date").min, field("Exam Date").max]).toEqual(["2026-09-07", "2026-09-27"]);
  });

  it("filters departments by their cleaned-up names, and counts each option given the other filters", () => {
    const f = blank();
    f.Department = { kind: "choice", values: ["CSE"] };
    expect(names(applyFilters(sheet, f, "", opts))).toEqual(["Asha", "Bala", "Gita", "Indu", "Latha"]);
    f.Section = { kind: "choice", values: ["A"] };
    expect(names(applyFilters(sheet, f, "", opts))).toEqual(["Asha", "Gita", "Indu"]);
    // Counts for Department reflect the Section filter, not the Department filter itself.
    expect(choiceCounts(sheet, field("Department"), f, "", opts)).toEqual([
      { value: "CSE", count: 3 },
      { value: "ECE", count: 2 },
      { value: "MECH", count: 2 },
    ]);
  });

  it("takes a register-number range in natural order, ignoring spaces", () => {
    const f = blank();
    f["Register Number"] = { kind: "text", contains: "", from: "21cs009", to: "21CS100" };
    expect(names(applyFilters(sheet, f, "", opts))).toEqual(["Bala", "Chitra", "Dinesh", "Esther"]);
    expect(compareRegister("21CS9", "21CS10")).toBeLessThan(0);
  });

  it("finds register numbers loosely and combines score, date and search filters", () => {
    const f = blank();
    f["Register Number"] = { kind: "text", contains: "21cs02", from: "", to: "" };
    expect(names(applyFilters(sheet, f, "", opts))).toEqual(["Dinesh"]);

    const g = blank();
    g.Score = { kind: "number", min: "60", max: "90" };
    g["Exam Date"] = { kind: "date", from: "2026-09-08", to: "2026-09-22" };
    expect(names(applyFilters(sheet, g, "", opts))).toEqual(["Esther", "Gita", "Hari"]);
    expect(names(applyFilters(sheet, g, "stead", opts))).toEqual(["Hari"]);
  });

  it("gives the score column a range even in a small file, and a few-valued number column a tick-list", () => {
    const small: DataSheet = {
      id: "s2",
      name: "Sheet1",
      headers: ["Name", "Semester", "Marks"],
      rows: [
        { Name: "A", Semester: 3, Marks: 70 },
        { Name: "B", Semester: 5, Marks: 55 },
        { Name: "C", Semester: 3, Marks: 90 },
      ],
    };
    const cols = inferColumns(small);
    const kinds = Object.fromEntries(buildFilterFields(small, cols, detectMapping(small, cols)).map((f) => [f.key, f.kind]));
    expect(kinds).toEqual({ Name: "text", Semester: "choice", Marks: "number" });
  });

  it("reads day-first and spreadsheet dates", () => {
    expect(cellDate("08/09/2026")).toBe("2026-09-08");
    expect(cellDate("31-02-2026")).toBeNull();
    expect(cellDate(46277)).toBe("2026-09-12");
  });

  it("describes active filters for the chips", () => {
    expect(describeFilter(field("Score"), { kind: "number", min: "60", max: "" })).toBe("Score: ≥ 60");
    expect(describeFilter(field("Register Number"), { kind: "text", contains: "", from: "21CS001", to: "21CS050" })).toBe("Register Number: 21CS001 – 21CS050");
  });
});
