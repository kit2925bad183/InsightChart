import { describe, expect, it } from "vitest";
import { parseNlQuery } from "./nlQuery";

const DEPTS = ["CSE", "CSBS", "ECE", "AIDS", "AIML"];

describe("parseNlQuery", () => {
  it("parses a below-threshold filter", () => {
    expect(parseNlQuery("Show students below 30 marks", DEPTS)).toEqual({ type: "filter-below", value: 30 });
  });

  it("parses an above-threshold filter", () => {
    expect(parseNlQuery("Show students above 60", DEPTS)).toEqual({ type: "filter-above", value: 60 });
  });

  it("parses a between-range filter", () => {
    expect(parseNlQuery("Show students scoring between 51 and 60", DEPTS)).toEqual({ type: "filter-range", min: 51, max: 60 });
  });

  it("parses a names-in-range request distinctly from a plain range", () => {
    expect(parseNlQuery("Show names of students scoring between 51 and 60", DEPTS)).toEqual({
      type: "names-range",
      min: 51,
      max: 60,
    });
  });

  it("parses a pie-chart-for-tiers request", () => {
    expect(parseNlQuery("Create a pie chart for performance tiers", DEPTS)).toEqual({ type: "pie-tiers" });
  });

  it("parses a department comparison naming two known departments", () => {
    expect(parseNlQuery("Compare CSBS and CSE average scores", DEPTS)).toEqual({
      type: "compare-departments",
      departments: ["CSE", "CSBS"],
    });
  });

  it("falls back to unknown with a helpful reason for gibberish", () => {
    const result = parseNlQuery("asdkjhaskjdh", DEPTS);
    expect(result.type).toBe("unknown");
  });

  it("falls back to unknown when comparing fewer than two departments", () => {
    const result = parseNlQuery("Compare CSE", DEPTS);
    expect(result.type).toBe("unknown");
  });

  it("handles an empty query", () => {
    expect(parseNlQuery("", DEPTS).type).toBe("unknown");
  });
});
