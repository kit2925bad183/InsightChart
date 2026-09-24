"use client";

import { useApp } from "@/context/AppContext";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import type { ChartType } from "@/lib/types";

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "bar", label: "Bar chart" },
  { value: "grouped-bar", label: "Grouped bar chart" },
  { value: "stacked-bar", label: "Stacked bar chart" },
  { value: "pie", label: "Pie chart" },
  { value: "donut", label: "Donut chart" },
  { value: "line", label: "Line chart" },
  { value: "area", label: "Area chart" },
  { value: "scatter", label: "Scatter plot" },
  { value: "histogram", label: "Histogram" },
  { value: "heatmap", label: "Heatmap" },
  { value: "flow", label: "Flow chart (relationships)" },
  { value: "table", label: "Table summary" },
];

export function MappingPanel() {
  const { state, dispatch, activeSheet, setMapping } = useApp();
  if (!activeSheet) return null;

  const headers = activeSheet.headers;
  const numericHeaders = state.columns.filter((c) => c.isNumeric).map((c) => c.key);

  return (
    <Card>
      <CardHeader title="Chart setup" subtitle="Choose the columns and chart type to visualise" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Select label="Category / X-axis" value={state.mapping.category ?? ""} onChange={(e) => setMapping({ category: e.target.value || undefined })}>
          <option value="">None</option>
          {headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </Select>
        <Select label="Numeric / Y-axis" value={state.mapping.numeric ?? ""} onChange={(e) => setMapping({ numeric: e.target.value || undefined })}>
          <option value="">None</option>
          {numericHeaders.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </Select>
        <Select label="Student name" value={state.mapping.studentName ?? ""} onChange={(e) => setMapping({ studentName: e.target.value || undefined })}>
          <option value="">None</option>
          {headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </Select>
        <Select label="Department / group" value={state.mapping.department ?? ""} onChange={(e) => setMapping({ department: e.target.value || undefined })}>
          <option value="">None</option>
          {headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </Select>
        <Select
          label="Chart type"
          value={state.chartType}
          onChange={(e) => dispatch({ type: "SET_CHART_TYPE", chartType: e.target.value as ChartType })}
        >
          {CHART_TYPES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-secondary)]">
          Score range min
          <input
            type="number"
            value={state.mapping.scoreMin ?? ""}
            placeholder="Min"
            onChange={(e) => setMapping({ scoreMin: e.target.value === "" ? undefined : Number(e.target.value) })}
            className="text-sm rounded-lg border border-[var(--border-strong)] bg-white px-2.5 py-1.5 tabular"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-secondary)]">
          Score range max
          <input
            type="number"
            value={state.mapping.scoreMax ?? ""}
            placeholder="Max"
            onChange={(e) => setMapping({ scoreMax: e.target.value === "" ? undefined : Number(e.target.value) })}
            className="text-sm rounded-lg border border-[var(--border-strong)] bg-white px-2.5 py-1.5 tabular"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-secondary)]">
          Chart title
          <input
            type="text"
            value={state.chartTitle}
            onChange={(e) => dispatch({ type: "SET_CHART_TITLE", title: e.target.value })}
            className="text-sm rounded-lg border border-[var(--border-strong)] bg-white px-2.5 py-1.5"
          />
        </label>
      </div>
    </Card>
  );
}
