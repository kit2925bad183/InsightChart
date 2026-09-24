"use client";

import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StudentRecord } from "@/lib/analysis/stats";
import { mean, round1 } from "@/lib/analysis/stats";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { categorical } from "@/lib/palette";
import { Users2, Scale, FileImage } from "lucide-react";
import { exportChartPng } from "@/lib/export";

export function DepartmentAnalysis({
  allRecords,
  supportThreshold,
  strongThreshold,
}: {
  allRecords: StudentRecord[];
  supportThreshold: number;
  strongThreshold: number;
}) {
  const departments = useMemo(
    () => Array.from(new Set(allRecords.map((r) => r.department))).filter((d) => d && d !== "—").sort(),
    [allRecords]
  );
  const [active, setActive] = useState<string>("__all__");
  const [compareMode, setCompareMode] = useState(false);
  const [compareSet, setCompareSet] = useState<string[]>(() => departments.slice(0, 3));
  const reportRef = useRef<HTMLDivElement>(null);

  if (!departments.length) {
    return (
      <Card>
        <CardHeader title="Department analysis" />
        <p className="text-sm text-[var(--text-muted)]">Map a department / group column to unlock this view.</p>
      </Card>
    );
  }

  const toggleCompare = (dept: string) => {
    setCompareSet((prev) => (prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]));
  };

  const scopedRecords = compareMode
    ? allRecords.filter((r) => compareSet.includes(r.department))
    : active === "__all__"
    ? allRecords
    : allRecords.filter((r) => r.department === active);

  const perDept = departments.map((d, i) => {
    const recs = allRecords.filter((r) => r.department === d);
    const scores = recs.map((r) => r.score);
    return {
      dept: d,
      color: categorical.light[i % categorical.light.length],
      total: recs.length,
      avg: scores.length ? round1(mean(scores)) : 0,
      top: [...recs].sort((a, b) => b.score - a.score).slice(0, 3),
      support: recs.filter((r) => r.score < supportThreshold).length,
      strong: recs.filter((r) => r.score >= strongThreshold).length,
    };
  });

  const chartData = perDept.map((d) => ({ dept: d.dept, "Average score": d.avg }));
  const compareStats = perDept.filter((d) => compareSet.includes(d.dept));

  return (
    <Card>
      <CardHeader
        title="Department analysis"
        subtitle={compareMode ? "Comparing selected departments side by side" : "View all departments or filter to one"}
        actions={
          <>
            {compareMode && (
              <Button size="sm" variant="ghost" onClick={() => reportRef.current && exportChartPng(reportRef.current, "department-comparison")}>
                <FileImage size={14} /> Export report
              </Button>
            )}
            <Button size="sm" variant={compareMode ? "primary" : "outline"} onClick={() => setCompareMode((v) => !v)}>
              <Scale size={14} /> {compareMode ? "Exit compare" : "Compare mode"}
            </Button>
          </>
        }
      />

      {!compareMode && (
        <div role="tablist" aria-label="Department filter" className="flex flex-wrap gap-1.5 mb-4">
          <button
            role="tab"
            aria-selected={active === "__all__"}
            onClick={() => setActive("__all__")}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              active === "__all__" ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--accent-soft)]"
            }`}
          >
            All departments
          </button>
          {departments.map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={active === d}
              onClick={() => setActive(d)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                active === d ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--accent-soft)]"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {compareMode && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {departments.map((d) => (
            <button
              key={d}
              onClick={() => toggleCompare(d)}
              aria-pressed={compareSet.includes(d)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                compareSet.includes(d) ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--accent-soft)]"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {!compareMode && (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="var(--gridline)" vertical={false} />
              <XAxis dataKey="dept" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} cursor={{ fill: "var(--accent-soft)" }} />
              <Bar dataKey="Average score" radius={[4, 4, 0, 0]} maxBarSize={44} fill={categorical.light[0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-[var(--text-muted)] mt-2 flex items-center gap-1.5">
            <Users2 size={13} /> {scopedRecords.length} students in current view
          </p>
        </>
      )}

      {compareMode && (
        <div ref={reportRef} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-[var(--surface)] p-1">
          {compareStats.map((d) => (
            <div key={d.dept} className="rounded-xl border border-[var(--border)] p-3.5 fade-in">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">{d.dept}</h4>
              </div>
              <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
                <dt className="text-[var(--text-muted)]">Total students</dt>
                <dd className="text-right font-medium tabular">{d.total}</dd>
                <dt className="text-[var(--text-muted)]">Average score</dt>
                <dd className="text-right font-medium tabular">{d.avg}</dd>
                <dt className="text-[var(--text-muted)]">Needs support</dt>
                <dd className="text-right font-medium tabular text-[var(--status-critical)]">{d.support}</dd>
                <dt className="text-[var(--text-muted)]">Strong</dt>
                <dd className="text-right font-medium tabular text-[var(--status-good)]">{d.strong}</dd>
              </dl>
              <p className="text-[11px] text-[var(--text-muted)] mt-2">Top performers</p>
              <ul className="text-xs text-[var(--text-primary)] mt-1 space-y-0.5">
                {d.top.map((s, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="truncate">{s.name}</span>
                    <span className="tabular font-medium">{s.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!compareStats.length && <p className="text-sm text-[var(--text-muted)] col-span-full">Select two or more departments above to compare.</p>}
        </div>
      )}
    </Card>
  );
}
