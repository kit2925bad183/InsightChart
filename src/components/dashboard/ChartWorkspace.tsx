"use client";

import { useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { useApp } from "@/context/AppContext";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Download, FileImage, Table2 } from "lucide-react";
import { exportChartPdf, exportChartPng, exportRowsCsv } from "@/lib/export";
import { categoricalVar, sequentialBlue } from "@/lib/palette";
import {
  categoryAggregates,
  crossAggregates,
  histogramBins,
  heatmapMatrix,
  tierDistribution,
  flowLinks,
} from "@/lib/analysis/aggregate";
import { FlowDiagram } from "@/components/charts/FlowDiagram";
import { fmt } from "@/lib/analysis/stats";
import { resolveDepartment } from "@/lib/analysis/normalizeDepartment";
import { resolveDrillDownFilter, type DrillDownResult } from "@/lib/analysis/chartDrillDown";
import type { ColumnMapping, DataSheet } from "@/lib/types";

const TOOLTIP_STYLE = { fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" };
const AXIS_TICK = { fontSize: 11, fill: "var(--text-muted)" };

export function ChartWorkspace() {
  const { state, activeSheet } = useApp();
  const chartRef = useRef<HTMLDivElement>(null);
  const { mapping, chartType, chartTitle, scoreBands, chartAccentIndex } = state;
  const accent = categoricalVar[chartAccentIndex % categoricalVar.length];
  const [drillDown, setDrillDown] = useState<DrillDownResult | null>(null);

  const handleDrillDown = (datum: Record<string, unknown>, currentRows: DataSheet["rows"]) => {
    const result = resolveDrillDownFilter(chartType, mapping, datum, currentRows, scoreBands);
    if (result && result.rows.length) setDrillDown(result);
  };

  const rows = useMemo(() => {
    if (!activeSheet) return [];
    let r = activeSheet.rows;
    if (mapping.scoreMin !== undefined && mapping.numeric) {
      r = r.filter((row) => Number(row[mapping.numeric!]) >= mapping.scoreMin!);
    }
    if (mapping.scoreMax !== undefined && mapping.numeric) {
      r = r.filter((row) => Number(row[mapping.numeric!]) <= mapping.scoreMax!);
    }
    if (mapping.department && state.normalizeDepartments) {
      const deptKey = mapping.department;
      r = r.map((row) => ({ ...row, [deptKey]: resolveDepartment(String(row[deptKey] ?? ""), state.departmentOverrides) }));
    }
    return r;
  }, [
    activeSheet,
    mapping.scoreMin,
    mapping.scoreMax,
    mapping.numeric,
    mapping.department,
    state.normalizeDepartments,
    state.departmentOverrides,
  ]);

  const hasCategory = !!mapping.category;
  const hasNumeric = !!mapping.numeric;

  const content = useMemo(() => {
    if (!activeSheet || !hasNumeric) {
      return <EmptyChart message="Select at least a numeric / Y-axis column above to generate a chart." />;
    }

    const numericKey = mapping.numeric!;
    const categoryKey = mapping.category ?? mapping.department;

    switch (chartType) {
      case "bar": {
        if (!categoryKey) return <EmptyChart message="Select a category / X-axis column to group by." />;
        const data = categoryAggregates(rows, categoryKey, numericKey);
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="var(--gridline)" vertical={false} />
              <XAxis dataKey="category" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--accent-soft)" }} />
              <Bar
                dataKey="avg"
                name={`Average ${numericKey}`}
                radius={[4, 4, 0, 0]}
                maxBarSize={52}
                fill={accent}
                cursor="pointer"
                onClick={(d: { category: string }) => handleDrillDown(d, rows)}
              />
            </BarChart>
          </ResponsiveContainer>
        );
      }
      case "grouped-bar":
      case "stacked-bar": {
        if (!categoryKey) return <EmptyChart message="Select a category / X-axis column to group by." />;
        const seriesKey = mapping.department && mapping.department !== categoryKey ? mapping.department : mapping.studentName;
        if (!seriesKey) return <EmptyChart message="Select a department column (different from category) to compare series." />;
        const { series, data } = crossAggregates(rows, categoryKey, seriesKey, numericKey);
        return (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="var(--gridline)" vertical={false} />
              <XAxis dataKey="category" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--accent-soft)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {series.map((s, i) => (
                <Bar
                  key={s}
                  dataKey={s}
                  stackId={chartType === "stacked-bar" ? "stack" : undefined}
                  fill={categoricalVar[i % categoricalVar.length]}
                  radius={chartType === "stacked-bar" ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                  maxBarSize={40}
                  cursor="pointer"
                  onClick={(d: { category: string }) => handleDrillDown({ ...d, __series: s }, rows)}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      }
      case "pie":
      case "donut": {
        const data = categoryKey ? categoryAggregates(rows, categoryKey, numericKey).map((d) => ({ name: d.category, value: d.count })) : tierDistribution(rows, numericKey, scoreBands);
        return (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={chartType === "donut" ? 64 : 0}
                outerRadius={110}
                paddingAngle={2}
                label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                labelLine={false}
                cursor="pointer"
                onClick={(d: { name: string }) => handleDrillDown(d, rows)}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={categoricalVar[i % categoricalVar.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );
      }
      case "line":
      case "area": {
        const xKey = mapping.dateColumn ?? categoryKey;
        if (!xKey) return <EmptyChart message="Select a date or category column to plot a trend." />;
        const data = categoryAggregates(rows, xKey, numericKey).sort((a, b) => a.category.localeCompare(b.category));
        const Chart = chartType === "line" ? LineChart : AreaChart;
        return (
          <ResponsiveContainer width="100%" height={320}>
            <Chart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="var(--gridline)" vertical={false} />
              <XAxis dataKey="category" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              {chartType === "line" ? (
                <Line
                  type="monotone"
                  dataKey="avg"
                  name={`Average ${numericKey}`}
                  stroke={accent}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{
                    r: 5,
                    style: { cursor: "pointer" },
                    onClick: ((props: { payload?: { category: string } }) => props.payload && handleDrillDown(props.payload, rows)) as never,
                  }}
                />
              ) : (
                <Area
                  type="monotone"
                  dataKey="avg"
                  name={`Average ${numericKey}`}
                  stroke={accent}
                  fill={accent}
                  fillOpacity={0.18}
                  strokeWidth={2}
                  activeDot={{
                    r: 5,
                    style: { cursor: "pointer" },
                    onClick: ((props: { payload?: { category: string } }) => props.payload && handleDrillDown(props.payload, rows)) as never,
                  }}
                />
              )}
            </Chart>
          </ResponsiveContainer>
        );
      }
      case "scatter": {
        const otherNumeric = state.columns.find((c) => c.isNumeric && c.key !== numericKey)?.key;
        if (!otherNumeric) return <EmptyChart message="Need a second numeric column to plot a scatter chart." />;
        const data = rows
          .map((r) => ({ x: Number(r[otherNumeric]), y: Number(r[numericKey]), name: mapping.studentName ? r[mapping.studentName] : undefined }))
          .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y));
        return (
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="var(--gridline)" />
              <XAxis type="number" dataKey="x" name={otherNumeric} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} />
              <YAxis type="number" dataKey="y" name={numericKey} tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <ZAxis range={[60, 60]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter
                data={data}
                fill={accent}
                fillOpacity={0.75}
                cursor="pointer"
                onClick={(d: { y: number }) => handleDrillDown(d, rows)}
              />
            </ScatterChart>
          </ResponsiveContainer>
        );
      }
      case "histogram": {
        const values = rows.map((r) => Number(r[numericKey])).filter(Number.isFinite);
        const data = histogramBins(values, 10, 100);
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="var(--gridline)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--accent-soft)" }} />
              <Bar
                dataKey="count"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
                fill={accent}
                cursor="pointer"
                onClick={(d: { label: string; min: number }) => handleDrillDown(d, rows)}
              />
            </BarChart>
          </ResponsiveContainer>
        );
      }
      case "heatmap": {
        if (!categoryKey) return <EmptyChart message="Select a category / department column for the heatmap rows." />;
        const { rowLabels, colLabels, cells, max } = heatmapMatrix(rows, categoryKey, numericKey, scoreBands);
        return (
          <HeatmapGrid
            rowLabels={rowLabels}
            colLabels={colLabels}
            cells={cells}
            max={max}
            onCellClick={(cell) => handleDrillDown(cell, rows)}
          />
        );
      }
      case "flow": {
        if (!categoryKey) return <EmptyChart message="Select a category / department column to map relationships." />;
        const { left, right, links } = flowLinks(rows, categoryKey, numericKey, scoreBands);
        if (!links.length) return <EmptyChart message="Not enough data to draw relationships yet." />;
        return <FlowDiagram left={left} right={right} links={links} onSelectLink={(link) => handleDrillDown({ ...link }, rows)} />;
      }
      case "table": {
        if (!categoryKey) return <EmptyChart message="Select a category / X-axis column to summarise." />;
        const data = categoryAggregates(rows, categoryKey, numericKey).sort((a, b) => b.avg - a.avg);
        return (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--surface-muted,#f2f6fc)] text-left">
                  <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">{categoryKey}</th>
                  <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Count</th>
                  <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Average</th>
                  <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Min</th>
                  <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Max</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr
                    key={d.category}
                    className="border-t border-[var(--border)] cursor-pointer hover:bg-[var(--accent-soft)]/40"
                    onClick={() => handleDrillDown({ ...d }, rows)}
                  >
                    <td className="px-3 py-1.5 font-medium">{fmt(d.category)}</td>
                    <td className="px-3 py-1.5 tabular">{d.count}</td>
                    <td className="px-3 py-1.5 tabular">{d.avg}</td>
                    <td className="px-3 py-1.5 tabular">{d.min}</td>
                    <td className="px-3 py-1.5 tabular">{d.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      default:
        return <EmptyChart message="Choose a chart type." />;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheet, hasNumeric, mapping, chartType, rows, state.columns, scoreBands, accent]);

  if (!activeSheet) return null;

  const csvRows = hasCategory && mapping.numeric ? categoryAggregates(rows, mapping.category!, mapping.numeric) : rows;

  return (
    <Card>
      <CardHeader
        title={chartTitle || "Custom chart"}
        subtitle="Built from the columns selected in Chart setup — click a bar, slice, point, or cell to see the students behind it"
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => chartRef.current && exportChartPng(chartRef.current, chartTitle || "chart")}>
              <FileImage size={14} /> PNG
            </Button>
            <Button size="sm" variant="ghost" onClick={() => chartRef.current && exportChartPdf(chartRef.current, chartTitle || "chart")}>
              <Download size={14} /> PDF
            </Button>
            <Button size="sm" variant="ghost" onClick={() => exportRowsCsv(csvRows as Record<string, unknown>[], chartTitle || "chart-data")}>
              <Table2 size={14} /> CSV
            </Button>
          </>
        }
      />
      <div ref={chartRef} className="bg-[var(--surface)] fade-in">
        {content}
      </div>
      {drillDown && <DrillDownModal result={drillDown} mapping={mapping} onClose={() => setDrillDown(null)} />}
    </Card>
  );
}

function DrillDownModal({ result, mapping, onClose }: { result: DrillDownResult; mapping: ColumnMapping; onClose: () => void }) {
  const preferredCols = [
    mapping.studentName && { key: mapping.studentName, label: "Name" },
    mapping.registration && { key: mapping.registration, label: "Registration" },
    mapping.department && { key: mapping.department, label: "Department" },
    mapping.numeric && { key: mapping.numeric, label: "Score" },
  ].filter((c): c is { key: string; label: string } => Boolean(c));

  const fallbackCols = Object.keys(result.rows[0] ?? {})
    .slice(0, 6)
    .map((k) => ({ key: k, label: k }));

  const cols = preferredCols.length ? preferredCols : fallbackCols;

  return (
    <Modal
      title={result.title}
      subtitle={`${result.rows.length} student${result.rows.length === 1 ? "" : "s"}`}
      onClose={onClose}
      width="lg"
    >
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[var(--surface-muted,#f2f6fc)] text-left">
              {cols.map((c) => (
                <th key={c.key} className="px-3 py-2 font-semibold text-[var(--text-secondary)]">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i} className="border-t border-[var(--border)]">
                {cols.map((c) => (
                  <td key={c.key} className="px-3 py-1.5 tabular text-[var(--text-primary)]">
                    {fmt(row[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function EmptyChart({ message }: { message: string }) {
  return <div className="h-64 flex items-center justify-center text-sm text-[var(--text-muted)] text-center px-6">{message}</div>;
}

function HeatmapGrid({
  rowLabels,
  colLabels,
  cells,
  max,
  onCellClick,
}: {
  rowLabels: string[];
  colLabels: string[];
  cells: { row: string; col: string; value: number }[];
  max: number;
  onCellClick?: (cell: { row: string; col: string; value: number }) => void;
}) {
  const lookup = new Map(cells.map((c) => [`${c.row}__${c.col}`, c.value]));
  const colorFor = (v: number) => {
    if (v === 0) return "var(--surface-muted,#f2f6fc)";
    const idx = Math.min(sequentialBlue.length - 1, Math.round((v / Math.max(1, max)) * (sequentialBlue.length - 1)));
    return sequentialBlue[idx];
  };
  return (
    <div className="overflow-x-auto">
      <table className="border-separate" style={{ borderSpacing: 3 }} role="img" aria-label="Heatmap of student counts by group and score band">
        <thead>
          <tr>
            <th />
            {colLabels.map((c) => (
              <th key={c} className="text-[10px] font-medium text-[var(--text-muted)] px-1 pb-1 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((r) => (
            <tr key={r}>
              <th scope="row" className="text-[11px] font-medium text-[var(--text-secondary)] pr-2 text-left whitespace-nowrap">
                {r}
              </th>
              {colLabels.map((c) => {
                const v = lookup.get(`${r}__${c}`) ?? 0;
                return (
                  <td key={c} title={`${r} · ${c}: ${v}`}>
                    <div
                      onClick={() => v > 0 && onCellClick?.({ row: r, col: c, value: v })}
                      className="h-9 w-11 rounded-md flex items-center justify-center text-[11px] font-semibold tabular"
                      style={{
                        background: colorFor(v),
                        color: v / Math.max(1, max) > 0.55 ? "#fff" : "var(--text-primary)",
                        cursor: v > 0 && onCellClick ? "pointer" : undefined,
                      }}
                    >
                      {v || ""}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
