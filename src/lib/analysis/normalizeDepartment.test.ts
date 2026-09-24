import { describe, expect, it } from "vitest";
import { canonicalDepartmentLabel, canonicalizeDepartment, departmentFullName } from "./normalizeDepartment";

describe("canonicalDepartmentLabel", () => {
  it("normalizes clean department codes as-is", () => {
    expect(canonicalDepartmentLabel("CSE")).toBe("CSE");
    expect(canonicalDepartmentLabel("ECE")).toBe("ECE");
    expect(canonicalDepartmentLabel("CSBS")).toBe("CSBS");
    expect(canonicalDepartmentLabel("EEE")).toBe("EEE");
  });

  it("collapses messy free-text CSE variants", () => {
    for (const raw of ["cse", "cse-IV", "IV/CSE", "IV - CSE", "Computer Science and Engineering", "4/CSE", "BE/CSE"]) {
      expect(canonicalDepartmentLabel(raw)).toBe("CSE");
    }
  });

  it("keeps AIML and AIDS as distinct departments", () => {
    expect(canonicalDepartmentLabel("CSE(AI&ML)")).toBe("AIML");
    expect(canonicalDepartmentLabel("AIML")).toBe("AIML");
    expect(canonicalDepartmentLabel("4th year-CSE(AI&ML)")).toBe("AIML");

    expect(canonicalDepartmentLabel("AI&DS")).toBe("AIDS");
    expect(canonicalDepartmentLabel("AIDS")).toBe("AIDS");
    expect(canonicalDepartmentLabel("Artificial Intelligence and Data Science")).toBe("AIDS");
    expect(canonicalDepartmentLabel("AI-DS  VI")).toBe("AIDS");
    expect(canonicalDepartmentLabel("IV/AI-DS")).toBe("AIDS");
  });

  it("handles empty/blank input", () => {
    expect(canonicalDepartmentLabel("")).toBe("Unlabeled");
    expect(canonicalDepartmentLabel("   ")).toBe("Unlabeled");
    expect(canonicalDepartmentLabel(null)).toBe("Unlabeled");
    expect(canonicalDepartmentLabel(undefined)).toBe("Unlabeled");
  });

  it("passes through an unrecognized value as its own code", () => {
    expect(canonicalDepartmentLabel("Astrophysics")).toBe("Astrophysics");
  });

  it("returns a full name alongside the code", () => {
    expect(canonicalizeDepartment("AI&ML")).toEqual({ code: "AIML", fullName: "Artificial Intelligence and Machine Learning" });
    expect(canonicalizeDepartment("AI&DS")).toEqual({ code: "AIDS", fullName: "Artificial Intelligence and Data Science" });
  });
});

describe("departmentFullName", () => {
  it("resolves known codes case-insensitively", () => {
    expect(departmentFullName("cse")).toBe("Computer Science and Engineering");
    expect(departmentFullName("AIDS")).toBe("Artificial Intelligence and Data Science");
  });

  it("falls back to the code itself when unknown", () => {
    expect(departmentFullName("Astrophysics")).toBe("Astrophysics");
  });
});
