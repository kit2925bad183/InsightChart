"use client";

import { useRef } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileImage, TrendingDown, TrendingUp, Minus, LineChart as LineIcon, BarChart3 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Select";
import { exportChartPng } from "@/lib/export";
import { round1, mean } from "@/lib/analysis/stats";
import { COMPARE_BY_LABELS, type CompareBy, type PeriodRow } from "@/lib/analysis/studentProgress";

const STUDENT_COLOR = "var(--series-1)";
const CLASS_COLOR = "var(--series-2)";
const TOP_COLOR = "var(--series-3)";

export type ChartView = "line" | "bar";

interface Datum extends PeriodRow {
  axisLabel: string;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Datum }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const grouped = d.tests.length > 1;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs shadow-lg max-w-64">
      <p className="font-semibold text-[var(--text-primary)] mb-1">{d.label}</p>
      {grouped && <p className="text-[var(--text-muted)] mb-1">Average of {d.tests.join(", ")}</p>}
      {d.score === null ? (
        <p className="text-[var(--text-muted)]">{d.ambiguous ? "Several students share this name — can't tell which one" : "Student not found in this file"}</p>
      ) : (
        <>
          <p className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <span className="h-2 w-2 rounded-sm" style={{ background: STUDENT_COLOR }} /> Score <span className="font-semibold text-[var(--text-primary)] tabular">{d.score}</span>
          </p>
          <p className="text-[var(--text-muted)] mt-0.5">
            {d.rank !== null && `Rank ${d.rank} of ${d.classSize}`}
            {d.rank !== null && d.change !== null && " · "}
            {d.change !== null && `${d.change > 0 ? "+" : ""}${d.change} vs previous`}
          </p>
        </>
      )}
      <p className="flex items-center gap-1.5 text-[var(--text-secondary)] mt-0.5">
        <span className="h-2 w-2 rounded-sm" style={{ background: CLASS_COLOR }} /> Class average <span className="font-semibold text-[var(--text-primary)] tabular">{d.classAverage}</span>
      </p>
      <p className="flex items-center gap-1.5 text-[var(--text-secondary)] mt-0.5">
        <span className="h-2 w-2 rounded-sm" style={{ background: TOP_COLOR }} /> Class top <span className="font-semibold text-[var(--text-primary)] tabular">{d.classTop}</span>
      </p>
    </div>
  );
}

function ChangeBadge({ change }: { change: number | null }) {
  if (change === null) return <span className="text-[var(--text-muted)]">—</span>;
  if (change === 0)
    return (
      <Badge tone="neutral">
        <Minus size={11} /> 0
      </Badge>
    );
  return change > 0 ? (
    <Badge tone="good">
      <TrendingUp size={11} /> +{change}
    </Badge>
  ) : (
    <Badge tone="critical">
      <TrendingDown size={11} /> {change}
    </Badge>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: React.ReactNode; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg border border-[var(--border)] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
            value === o.value ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--accent-soft)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] px-3 py-2 min-w-0">
      <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
      <p className="text-lg font-semibold text-[var(--text-primary)] tabular leading-tight">{value}</p>
      {hint && <p className="text-[11px] text-[var(--text-muted)] truncate" title={hint}>{hint}</p>}
    </div>
  );
}

export function StudentPerformanceChart({
  name,
  registration,
  rows,
  undated,
  by,
  view,
  onByChange,
  onViewChange,
  canDownload,
}: {
  name: string;
  registration: string;
  rows: PeriodRow[];
  /** Tests left out of a date-wise view because they have no date. */
  undated: string[];
  by: CompareBy;
  view: ChartView;
  onByChange: (by: CompareBy) => void;
  onViewChange: (view: ChartView) => void;
  canDownload: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const data: Datum[] = rows.map((r) => ({ ...r, axisLabel: r.score === null ? `${r.label} (not found)` : r.label }));
  const scored = rows.filter((r) => r.score !== null);
  const first = scored[0];
  const last = scored[scored.length - 1];
  const overall = scored.length >= 2 ? round1(last.score! - first.score!) : null;
  const aboveAverage = scored.filter((r) => r.score! >= r.classAverage).length;
  const best = scored.reduce<PeriodRow | null>((b, r) => (!b || r.score! > b.score! ? r : b), null);
  const worst = scored.reduce<PeriodRow | null>((w, r) => (!w || r.score! < w.score! ? r : w), null);
  const unit = by === "test" ? "assessments" : by === "day" ? "days" : by === "week" ? "weeks" : "months";
  const title = `${name}${registration && registration !== "—" ? ` · ${registration}` : ""}`;

  const axis = (
    <>
      <CartesianGrid stroke="var(--gridline)" vertical={false} />
      <XAxis dataKey="axisLabel" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} interval={0} />
      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
      <Tooltip content={<ChartTooltip />} cursor={view === "bar" ? { fill: "var(--accent-soft)" } : { stroke: "var(--border-strong)" }} />
      <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} iconType={view === "bar" ? "square" : "plainline"} iconSize={10} />
    </>
  );

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={`${COMPARE_BY_LABELS[by]} scores compared with the class average and the class top`}
        actions={
          canDownload ? (
            <Button size="sm" variant="ghost" onClick={() => ref.current && exportChartPng(ref.current, `student-performance-${by}-${(registration || name).replace(/[^a-z0-9]+/gi, "-")}`)}>
              <FileImage size={14} /> PNG
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Segmented
          label="Compare by"
          value={by}
          onChange={onByChange}
          options={(Object.keys(COMPARE_BY_LABELS) as CompareBy[]).map((v) => ({ value: v, label: COMPARE_BY_LABELS[v] }))}
        />
        <Segmented
          label="Chart type"
          value={view}
          onChange={onViewChange}
          options={[
            { value: "line", label: <><LineIcon size={13} /> Flow</>, title: "Line chart" },
            { value: "bar", label: <><BarChart3 size={13} /> Bars</>, title: "Bar chart" },
          ]}
        />
      </div>

      {undated.length > 0 && (
        <p className="text-xs text-[var(--status-warning,#8a5a00)] mb-3" data-testid="undated-note">
          Left out because they have no date: {undated.join(", ")}. Set a date on each file under “Assessments to compare”.
        </p>
      )}

      <div ref={ref} className="bg-[var(--surface)]">
        {scored.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <Stat label="Average score" value={round1(mean(scored.map((r) => r.score!)))} hint={`over ${scored.length} ${unit}`} />
            <Stat label="Best" value={best!.score} hint={best!.label} />
            <Stat label="Lowest" value={worst!.score} hint={worst!.label} />
            <Stat label="Overall change" value={overall === null ? "—" : `${overall > 0 ? "+" : ""}${overall}`} hint={overall === null ? "needs 2 or more" : `${first.label} → ${last.label}`} />
          </div>
        )}
        {scored.length >= 2 && (
          <p className="text-sm text-[var(--text-secondary)] mb-3" data-testid="performance-summary">
            {overall! > 0 ? "Improved by " : overall! < 0 ? "Dropped by " : "No change "}
            {overall !== 0 && <span className="font-semibold text-[var(--text-primary)] tabular">{Math.abs(overall!)} marks</span>} from {first.label} to {last.label}
            {" · "}at or above the class average in {aboveAverage} of {scored.length} {unit}.
          </p>
        )}
        {rows.length === 0 ? (
          <div className="h-40 grid place-items-center text-sm text-[var(--text-muted)]">No dated assessments to show {COMPARE_BY_LABELS[by].toLowerCase()}.</div>
        ) : (
          <div className="h-72" role="img" aria-label={`${view === "line" ? "Line" : "Bar"} chart of ${name}'s ${COMPARE_BY_LABELS[by].toLowerCase()} score, the class average and the class top across ${rows.length} ${unit}`}>
            <ResponsiveContainer width="100%" height="100%">
              {view === "line" ? (
                <LineChart data={data} margin={{ top: 20, right: 16, left: -12, bottom: 4 }}>
                  {axis}
                  <Line type="monotone" dataKey="score" name={name} stroke={STUDENT_COLOR} strokeWidth={2.5} dot={{ r: 4, fill: STUDENT_COLOR }} activeDot={{ r: 6 }} connectNulls isAnimationActive={false}>
                    <LabelList dataKey="score" position="top" style={{ fontSize: 11, fontWeight: 600, fill: "var(--text-primary)" }} />
                  </Line>
                  <Line type="monotone" dataKey="classAverage" name="Class average" stroke={CLASS_COLOR} strokeWidth={2} dot={{ r: 3, fill: CLASS_COLOR }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="classTop" name="Class top" stroke={TOP_COLOR} strokeWidth={1.5} strokeDasharray="5 4" dot={{ r: 2.5, fill: TOP_COLOR }} isAnimationActive={false} />
                </LineChart>
              ) : (
                <BarChart data={data} margin={{ top: 20, right: 8, left: -12, bottom: 4 }} barGap={2} barCategoryGap="24%">
                  {axis}
                  <Bar dataKey="score" name={name} fill={STUDENT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={44}>
                    <LabelList dataKey="score" position="top" style={{ fontSize: 11, fontWeight: 600, fill: "var(--text-primary)" }} />
                  </Bar>
                  <Bar dataKey="classAverage" name="Class average" fill={CLASS_COLOR} radius={[4, 4, 0, 0]} maxBarSize={44} />
                  <Bar dataKey="classTop" name="Class top" fill={TOP_COLOR} radius={[4, 4, 0, 0]} maxBarSize={44} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-xs" aria-label={`Student performance ${COMPARE_BY_LABELS[by].toLowerCase()}`}>
            <thead>
              <tr className="bg-[var(--surface-muted)] text-left">
                <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">{by === "test" ? "Assessment" : by === "day" ? "Day" : by === "week" ? "Week" : "Month"}</th>
                {by !== "test" && <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Tests</th>}
                <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Score</th>
                <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Class average</th>
                <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Class top</th>
                <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Rank</th>
                <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-medium text-[var(--text-primary)] whitespace-nowrap">{r.label}</td>
                  {by !== "test" && <td className="px-3 py-2 text-[var(--text-secondary)]">{r.tests.join(", ")}</td>}
                  <td className="px-3 py-2 tabular font-semibold">
                    {r.score ?? <span className="font-normal text-[var(--text-muted)]">{r.ambiguous ? "Name matches several students" : "Not found"}</span>}
                  </td>
                  <td className="px-3 py-2 tabular text-[var(--text-secondary)]">{r.classAverage}</td>
                  <td className="px-3 py-2 tabular text-[var(--text-secondary)]">{r.classTop}</td>
                  <td className="px-3 py-2 tabular text-[var(--text-secondary)]">{r.rank ? `${r.rank} / ${r.classSize}` : "—"}</td>
                  <td className="px-3 py-2">
                    <ChangeBadge change={r.change} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-[var(--text-muted)] mt-2">
        Students are matched across files by register number (ignoring spaces and case), or by exact name when a file has no register numbers.
        {by !== "test" && " When several tests fall in the same period, the score and class average are averaged; rank is shown only for single tests."}
      </p>
    </Card>
  );
}
