import { describe, expect, it } from "vitest";
import { buildStudentProgress, dateFromFileName, findStudent, groupProgress, normalizeKey, searchStudents } from "./studentProgress";
import type { StudentRecord } from "./stats";

const rec = (name: string, registration: string, score: number, department = "CSE"): StudentRecord => ({ row: {}, name, registration, department, score });

const test1 = [rec("Alice Mary", "21CS001", 70), rec("Bob", "21CS002", 50), rec("Carol", "21CS003", 90)];
const test2 = [rec("ALICE MARY", "21 cs 001", 82), rec("Bob", "21CS002", 60), rec("Carol", "21CS003", 88), rec("Dan", "21CS004", 40)];
const test3 = [rec("Bob", "21CS002", 65), rec("Carol", "21CS003", 70)];

describe("student matching across files", () => {
  it("matches register numbers ignoring case, spaces and punctuation", () => {
    expect(normalizeKey("21 cs-001")).toBe("21CS001");
    const m = findStudent(test2, { name: "Someone Else", registration: "21cs001" });
    expect(m && "record" in m && m.record.score).toBe(82);
    expect(m && "matchedBy" in m && m.matchedBy).toBe("registration");
  });

  it("falls back to an exact name when the register number isn't present", () => {
    const m = findStudent([rec("Alice Mary", "—", 55)], { name: "alice  mary", registration: "21CS001" });
    expect(m && "matchedBy" in m && m.matchedBy).toBe("name");
  });

  it("refuses to guess between two students with the same name", () => {
    expect(findStudent([rec("Bob", "—", 10), rec("Bob", "—", 20)], { name: "Bob", registration: "—" })).toEqual({ ambiguous: true });
  });
});

describe("buildStudentProgress", () => {
  it("gives score, class average, rank and change per file, with gaps where the student is missing", () => {
    const rows = buildStudentProgress({ name: "Alice Mary", registration: "21CS001" }, [
      { id: "a", label: "Test 1", records: test1 },
      { id: "b", label: "Test 2", records: test2 },
      { id: "c", label: "Test 3", records: test3 },
    ]);
    expect(rows.map((r) => [r.label, r.score, r.classAverage, r.rank, r.classSize, r.change])).toEqual([
      ["Test 1", 70, 70, 2, 3, null],
      ["Test 2", 82, 67.5, 2, 4, 12],
      ["Test 3", null, 67.5, null, 2, null],
    ]);
  });
});

describe("searchStudents", () => {
  it("finds by part of the name or register number, one entry per student", () => {
    expect(searchStudents(test1, "ali").map((r) => r.name)).toEqual(["Alice Mary"]);
    expect(searchStudents(test1, "cs00").map((r) => r.registration)).toEqual(["21CS001", "21CS002", "21CS003"]);
    expect(searchStudents(test1, "  ")).toEqual([]);
  });
});

describe("groupProgress", () => {
  const rows = buildStudentProgress({ name: "Bob", registration: "21CS002" }, [
    { id: "a", label: "Test 1", records: test1, date: "2026-09-07" },
    { id: "b", label: "Test 2", records: test2, date: "2026-09-07" },
    { id: "c", label: "Test 3", records: test3, date: "2026-09-10" },
    { id: "d", label: "Retest", records: test3, date: "" },
  ]);

  it("keeps one point per test, in file order, for test-wise", () => {
    const g = groupProgress(rows, "test");
    expect(g.rows.map((r) => r.label)).toEqual(["Test 1", "Test 2", "Test 3", "Retest"]);
    expect(g.rows[0].classTop).toBe(90);
    expect(g.undated).toEqual([]);
  });

  it("averages tests on the same day and leaves out undated ones", () => {
    const g = groupProgress(rows, "day");
    expect(g.rows.map((r) => [r.label, r.score, r.classAverage, r.classTop, r.change, r.tests.length])).toEqual([
      ["7 Sep 2026", 55, 68.8, 90, null, 2],
      ["10 Sep 2026", 65, 67.5, 70, 10, 1],
    ]);
    expect(g.undated).toEqual(["Retest"]);
  });

  it("buckets by Monday-start week and by month", () => {
    expect(groupProgress(rows, "week").rows.map((r) => [r.label, r.score])).toEqual([["Week of 7 Sep 2026", 58.3]]);
    expect(groupProgress(rows, "month").rows.map((r) => [r.label, r.tests])).toEqual([["Sep 2026", ["Test 1", "Test 2", "Test 3"]]]);
  });
});

describe("dateFromFileName", () => {
  it("reads common date formats, day first", () => {
    expect(dateFromFileName("Test 1 2026-09-12.xlsx")).toBe("2026-09-12");
    expect(dateFromFileName("CAT_12.09.2026.csv")).toBe("2026-09-12");
    expect(dateFromFileName("unit test 05-08-26.xlsx")).toBe("2026-08-05");
    expect(dateFromFileName("Model exam 3rd Oct 2026.pdf")).toBe("2026-10-03");
    expect(dateFromFileName("Model exam September 21, 2026.pdf")).toBe("2026-09-21");
  });

  it("returns empty for no date or an impossible one", () => {
    expect(dateFromFileName("Placement Mock Assessment 1.xlsx")).toBe("");
    expect(dateFromFileName("marks 31-02-2026.xlsx")).toBe("");
  });
});
