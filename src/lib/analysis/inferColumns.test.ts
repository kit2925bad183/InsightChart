import { describe, expect, it } from "vitest";
import { inferColumns, detectScoreColumn, detectMapping } from "./inferColumns";
import type { DataSheet } from "../types";

const sheet: DataSheet = {
  id: "s1",
  name: "Responses",
  headers: ["Timestamp", "Score", "Name", "Registration Number", "Class / Department", "1. Some question?"],
  rows: [
    { Timestamp: "2026-01-01", Score: 72, Name: "Alice", "Registration Number": "R001", "Class / Department": "CSE", "1. Some question?": "42" },
    { Timestamp: "2026-01-02", Score: 55, Name: "Bob", "Registration Number": "R002", "Class / Department": "ECE", "1. Some question?": "yes" },
  ],
};

describe("inferColumns", () => {
  const columns = inferColumns(sheet);

  it("identifies the Score column as a score column", () => {
    expect(columns.find((c) => c.key === "Score")?.role).toBe("score");
  });

  it("identifies the Name column as a name column", () => {
    expect(columns.find((c) => c.key === "Name")?.role).toBe("name");
  });

  it("identifies Registration Number as a registration column", () => {
    expect(columns.find((c) => c.key === "Registration Number")?.role).toBe("registration");
  });

  it("identifies Class / Department as a department column", () => {
    expect(columns.find((c) => c.key === "Class / Department")?.role).toBe("department");
  });

  it("does not misclassify a mixed-type question column as numeric", () => {
    expect(columns.find((c) => c.key === "1. Some question?")?.isNumeric).toBe(false);
  });
});

describe("detectScoreColumn", () => {
  it("picks the explicitly-named Score column over other numeric columns", () => {
    const columns = inferColumns(sheet);
    expect(detectScoreColumn(sheet, columns)).toBe("Score");
  });
});

describe("detectMapping", () => {
  it("auto-maps score/name/registration/department from headers alone", () => {
    const columns = inferColumns(sheet);
    const mapping = detectMapping(sheet, columns);
    expect(mapping.numeric).toBe("Score");
    expect(mapping.studentName).toBe("Name");
    expect(mapping.registration).toBe("Registration Number");
    expect(mapping.department).toBe("Class / Department");
    expect(mapping.category).toBe("Class / Department");
  });
});
