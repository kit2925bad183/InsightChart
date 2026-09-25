import type { ColumnMapping, DataSheet, ChartType, ScoreBand } from "../types";
import { bandForScore } from "./scoreBands";

export interface DrillDownResult {
  title: string;
  rows: DataSheet["rows"];
}

const TIER_LABEL = { support: "Needs support", developing: "Developing", strong: "Strong" } as const;

function tierLabelForScore(n: number, bands: ScoreBand[]): string | null {
  const band = bandForScore(n, bands);
  return band ? TIER_LABEL[band.tier] : null;
}

/** Resolves "which raw rows does this clicked chart datum represent," per chart type —
 * operates on the same `rows`/`mapping` ChartWorkspace already derives its charts from,
 * so every chart type in Interactive Charts can click through to the underlying students. */
export function resolveDrillDownFilter(
  chartType: ChartType,
  mapping: ColumnMapping,
  datum: Record<string, unknown>,
  rows: DataSheet["rows"],
  scoreBands: ScoreBand[]
): DrillDownResult | null {
  const categoryKey = mapping.category ?? mapping.department;
  const numericKey = mapping.numeric;

  switch (chartType) {
    case "bar":
    case "table": {
      if (!categoryKey) return null;
      const category = String(datum.category ?? "");
      return { title: category, rows: rows.filter((r) => String(r[categoryKey] ?? "Unlabeled") === category) };
    }
    case "grouped-bar":
    case "stacked-bar": {
      if (!categoryKey) return null;
      const category = String(datum.category ?? "");
      const seriesKey = mapping.department && mapping.department !== categoryKey ? mapping.department : mapping.studentName;
      const seriesName = typeof datum.__series === "string" ? datum.__series : undefined;
      let filtered = rows.filter((r) => String(r[categoryKey] ?? "Unlabeled") === category);
      if (seriesKey && seriesName) filtered = filtered.filter((r) => String(r[seriesKey] ?? "Unlabeled") === seriesName);
      return { title: seriesName ? `${category} · ${seriesName}` : category, rows: filtered };
    }
    case "pie":
    case "donut": {
      const name = String(datum.name ?? "");
      if (categoryKey) {
        return { title: name, rows: rows.filter((r) => String(r[categoryKey] ?? "Unlabeled") === name) };
      }
      if (!numericKey) return null;
      return {
        title: name,
        rows: rows.filter((r) => {
          const n = Number(r[numericKey]);
          return Number.isFinite(n) && tierLabelForScore(n, scoreBands) === name;
        }),
      };
    }
    case "line":
    case "area": {
      const xKey = mapping.dateColumn ?? categoryKey;
      if (!xKey) return null;
      const category = String(datum.category ?? "");
      return { title: category, rows: rows.filter((r) => String(r[xKey] ?? "Unlabeled") === category) };
    }
    case "scatter": {
      if (!numericKey) return null;
      const y = Number(datum.y);
      if (!Number.isFinite(y)) return null;
      return { title: `Score ${y}`, rows: rows.filter((r) => Number(r[numericKey]) === y) };
    }
    case "histogram": {
      if (!numericKey) return null;
      const label = String(datum.label ?? "");
      const min = Number(datum.min ?? 0);
      const [loStr, hiStr] = label.split("-");
      const lo = Number.isFinite(Number(loStr)) ? Number(loStr) : min;
      const hi = Number.isFinite(Number(hiStr)) ? Number(hiStr) : min + 10;
      return {
        title: label,
        rows: rows.filter((r) => {
          const n = Number(r[numericKey]);
          return Number.isFinite(n) && n >= lo && n < hi;
        }),
      };
    }
    case "heatmap": {
      if (!categoryKey || !numericKey) return null;
      const rowLabel = String(datum.row ?? "");
      const colLabel = String(datum.col ?? "");
      return {
        title: `${rowLabel} · ${colLabel}`,
        rows: rows.filter((r) => {
          if (String(r[categoryKey] ?? "Unlabeled") !== rowLabel) return false;
          const n = Number(r[numericKey]);
          const band = Number.isFinite(n) ? bandForScore(n, scoreBands) : undefined;
          return band?.label === colLabel;
        }),
      };
    }
    case "flow": {
      if (!categoryKey || !numericKey) return null;
      const source = String(datum.source ?? "");
      const target = String(datum.target ?? "");
      return {
        title: `${source} → ${target}`,
        rows: rows.filter((r) => {
          if (String(r[categoryKey] ?? "Unlabeled") !== source) return false;
          const n = Number(r[numericKey]);
          return Number.isFinite(n) && tierLabelForScore(n, scoreBands) === target;
        }),
      };
    }
    default:
      return null;
  }
}
