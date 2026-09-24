import type { DataSheet, ScoreBand } from "../types";
import { bandForScore } from "./scoreBands";
import { mean, round1 } from "./stats";

function numOf(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface CategoryAgg {
  category: string;
  count: number;
  avg: number;
  sum: number;
  min: number;
  max: number;
}

export function categoryAggregates(rows: DataSheet["rows"], categoryKey: string, numericKey: string): CategoryAgg[] {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const cat = String(row[categoryKey] ?? "Unlabeled");
    const n = numOf(row[numericKey]);
    if (n === null) continue;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(n);
  }
  return Array.from(groups.entries()).map(([category, values]) => ({
    category,
    count: values.length,
    avg: round1(mean(values)),
    sum: round1(values.reduce((a, b) => a + b, 0)),
    min: Math.min(...values),
    max: Math.max(...values),
  }));
}

/** Pivots rows into { category, [series]: avgNumeric } for grouped/stacked charts. Caps series count at 8 (categorical palette limit). */
export function crossAggregates(rows: DataSheet["rows"], categoryKey: string, seriesKey: string, numericKey: string) {
  const seriesValues = Array.from(new Set(rows.map((r) => String(r[seriesKey] ?? "Unlabeled")))).slice(0, 8);
  const categories = Array.from(new Set(rows.map((r) => String(r[categoryKey] ?? "Unlabeled"))));

  const data = categories.map((cat) => {
    const entry: Record<string, string | number> = { category: cat };
    for (const s of seriesValues) {
      const vals = rows
        .filter((r) => String(r[categoryKey] ?? "Unlabeled") === cat && String(r[seriesKey] ?? "Unlabeled") === s)
        .map((r) => numOf(r[numericKey]))
        .filter((n): n is number => n !== null);
      entry[s] = vals.length ? round1(mean(vals)) : 0;
    }
    return entry;
  });

  return { series: seriesValues, data };
}

export function histogramBins(values: number[], binSize = 10, max = 100) {
  const bins: { label: string; count: number; min: number }[] = [];
  for (let lo = 0; lo < max; lo += binSize) {
    const hi = lo + binSize;
    bins.push({ label: `${lo}-${hi}`, count: 0, min: lo });
  }
  for (const v of values) {
    const idx = Math.min(bins.length - 1, Math.floor(v / binSize));
    if (bins[idx]) bins[idx].count++;
  }
  return bins.filter((b, i) => b.count > 0 || (i > 0 && bins[i - 1].count > 0) || i === 0);
}

export interface HeatmapCell {
  row: string;
  col: string;
  value: number;
}

export function heatmapMatrix(
  rows: DataSheet["rows"],
  rowKey: string,
  numericKey: string,
  bands: ScoreBand[]
): { rowLabels: string[]; colLabels: string[]; cells: HeatmapCell[]; max: number } {
  const rowLabels = Array.from(new Set(rows.map((r) => String(r[rowKey] ?? "Unlabeled")))).sort();
  const colLabels = bands.map((b) => b.label);
  const counts = new Map<string, number>();

  for (const row of rows) {
    const n = numOf(row[numericKey]);
    if (n === null) continue;
    const band = bandForScore(n, bands);
    if (!band) continue;
    const rLabel = String(row[rowKey] ?? "Unlabeled");
    const key = `${rLabel}__${band.label}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const cells: HeatmapCell[] = [];
  let max = 0;
  for (const r of rowLabels) {
    for (const c of colLabels) {
      const value = counts.get(`${r}__${c}`) ?? 0;
      cells.push({ row: r, col: c, value });
      if (value > max) max = value;
    }
  }

  return { rowLabels, colLabels, cells, max };
}

const TIER_LABEL = { support: "Needs support", developing: "Developing", strong: "Strong" } as const;

export interface FlowLink {
  source: string;
  target: string;
  value: number;
}

export function flowLinks(rows: DataSheet["rows"], categoryKey: string, numericKey: string, bands: ScoreBand[]) {
  const left = Array.from(new Set(rows.map((r) => String(r[categoryKey] ?? "Unlabeled")))).sort();
  const right = ["Strong", "Developing", "Needs support"];
  const counts = new Map<string, number>();

  for (const row of rows) {
    const n = numOf(row[numericKey]);
    if (n === null) continue;
    const band = bandForScore(n, bands);
    if (!band) continue;
    const cat = String(row[categoryKey] ?? "Unlabeled");
    const key = `${cat}__${TIER_LABEL[band.tier]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const links: FlowLink[] = [];
  for (const l of left) {
    for (const r of right) {
      const value = counts.get(`${l}__${r}`) ?? 0;
      if (value > 0) links.push({ source: l, target: r, value });
    }
  }
  return { left, right, links };
}

export function tierDistribution(rows: DataSheet["rows"], numericKey: string, bands: ScoreBand[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const n = numOf(row[numericKey]);
    if (n === null) continue;
    const band = bandForScore(n, bands);
    if (!band) continue;
    const label = TIER_LABEL[band.tier];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
}
