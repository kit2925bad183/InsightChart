import { describe, expect, it } from "vitest";
import { toStudentRecords, mean, round1, fmt } from "./stats";
import type { DataSheet } from "../types";

describe("mean / round1", () => {
  it("computes the arithmetic mean", () => {
    expect(mean([10, 20, 30])).toBe(20);
    expect(mean([])).toBe(0);
  });

  it("rounds to one decimal place", () => {
    expect(round1(12.345)).toBe(12.3);
    expect(round1(12.35)).toBe(12.4);
  });
});

describe("fmt", () => {
  it("renders null/undefined as an em dash", () => {
    expect(fmt(null)).toBe("—");
    expect(fmt(undefined as unknown as null)).toBe("—");
  });

  it("stringifies other values", () => {
    expect(fmt(42)).toBe("42");
    expect(fmt("hi")).toBe("hi");
  });
});

describe("toStudentRecords", () => {
  const sheet: DataSheet = {
    id: "s1",
    name: "Sheet1",
    headers: ["Name", "Dept", "Score"],
    rows: [
      { Name: "Alice", Dept: "cse", Score: 80 },
      { Name: "Bob", Dept: "CSE", Score: "not a number" },
      { Name: "Carol", Dept: "ECE", Score: 60 },
    ],
  };

  it("drops rows whose score isn't numeric", () => {
    const records = toStudentRecords(sheet, { studentName: "Name", department: "Dept", numeric: "Score" });
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.name)).toEqual(["Alice", "Carol"]);
  });

  it("returns nothing when no numeric column is mapped", () => {
    expect(toStudentRecords(sheet, { studentName: "Name" })).toEqual([]);
  });

  it("canonicalizes department by default", () => {
    const records = toStudentRecords(sheet, { studentName: "Name", department: "Dept", numeric: "Score" });
    const alice = records.find((r) => r.name === "Alice");
    expect(alice?.department).toBe("CSE"); // "cse" normalized to "CSE"
  });

  it("keeps raw department text when normalization is disabled", () => {
    const records = toStudentRecords(sheet, { studentName: "Name", department: "Dept", numeric: "Score" }, false);
    const alice = records.find((r) => r.name === "Alice");
    expect(alice?.department).toBe("cse");
  });
});
