import { describe, expect, it } from "vitest";
import { categoryAggregates, crossAggregates, histogramBins, heatmapMatrix, tierDistribution, flowLinks } from "./aggregate";
import { DEFAULT_BANDS } from "./scoreBands";
import type { DataSheet } from "../types";

const rows: DataSheet["rows"] = [
  { Department: "CSE", Score: 80 },
  { Department: "CSE", Score: 40 },
  { Department: "ECE", Score: 20 },
  { Department: "ECE", Score: 60 },
  { Department: "ECE", Score: 60 },
];

describe("categoryAggregates", () => {
  it("groups and averages numeric values per category", () => {
    const result = categoryAggregates(rows, "Department", "Score");
    const cse = result.find((r) => r.category === "CSE")!;
    const ece = result.find((r) => r.category === "ECE")!;
    expect(cse.count).toBe(2);
    expect(cse.avg).toBe(60);
    expect(ece.count).toBe(3);
    expect(ece.min).toBe(20);
    expect(ece.max).toBe(60);
  });
});

describe("crossAggregates", () => {
  it("pivots into per-category, per-series averages", () => {
    const { series, data } = crossAggregates(rows, "Department", "Department", "Score");
    expect(series.sort()).toEqual(["CSE", "ECE"]);
    const cseRow = data.find((d) => d.category === "CSE")!;
    expect(cseRow.CSE).toBe(60);
    expect(cseRow.ECE).toBe(0);
  });
});

describe("histogramBins", () => {
  it("buckets values into fixed-width bins", () => {
    const bins = histogramBins([5, 15, 15, 82], 10, 100);
    expect(bins.find((b) => b.label === "0-10")?.count).toBe(1);
    expect(bins.find((b) => b.label === "10-20")?.count).toBe(2);
  });
});

describe("heatmapMatrix", () => {
  it("builds a row x score-band count matrix", () => {
    const { rowLabels, colLabels, cells, max } = heatmapMatrix(rows, "Department", "Score", DEFAULT_BANDS);
    expect(rowLabels).toEqual(["CSE", "ECE"]);
    expect(colLabels).toHaveLength(DEFAULT_BANDS.length);
    const eceStrongCell = cells.find((c) => c.row === "ECE" && c.col === "51–60");
    expect(eceStrongCell?.value).toBe(2);
    expect(max).toBeGreaterThanOrEqual(2);
  });
});

describe("tierDistribution", () => {
  it("counts students per performance tier", () => {
    const dist = tierDistribution(rows, "Score", DEFAULT_BANDS);
    const strong = dist.find((d) => d.name === "Strong");
    expect(strong?.value).toBe(3); // 80, 60, 60
  });
});

describe("flowLinks", () => {
  it("builds department -> tier links with correct counts", () => {
    const { left, right, links } = flowLinks(rows, "Department", "Score", DEFAULT_BANDS);
    expect(left).toEqual(["CSE", "ECE"]);
    expect(right).toEqual(["Strong", "Developing", "Needs support"]);
    const eceStrong = links.find((l) => l.source === "ECE" && l.target === "Strong");
    expect(eceStrong?.value).toBe(2);
  });
});
