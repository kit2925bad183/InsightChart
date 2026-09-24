"use client";

import { useMemo, useRef } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ScoreBand } from "@/lib/types";
import type { StudentRecord } from "@/lib/analysis/stats";
import { mean, round1 } from "@/lib/analysis/stats";
import { bandForScore, deriveTierThresholds } from "@/lib/analysis/scoreBands";
import { tierColor } from "@/lib/palette";
import { Button } from "@/components/ui/Button";
import { Download, FileImage } from "lucide-react";
import { exportChartPdf, exportChartPng } from "@/lib/export";

const TIER_META = {
  support: { label: "Needs support", color: tierColor.support.light, soft: "var(--status-critical-soft)" },
  developing: { label: "Developing", color: tierColor.developing.light, soft: "var(--status-warning-soft)" },
  strong: { label: "Strong", color: tierColor.strong.light, soft: "var(--status-good-soft)" },
} as const;

function Chip({
  label,
  value,
  accent,
  soft,
}: {
  label: string;
  value: string;
  accent: string;
  soft: string;
}) {
  return (
    <div className="rounded-xl px-3.5 py-3 flex-1 min-w-[130px]" style={{ background: soft, borderLeft: `3px solid ${accent}` }}>
      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: accent }}>
        {label}
      </p>
      <p className="text-xl font-extrabold text-[var(--text-primary)] tabular mt-0.5">{value}</p>
    </div>
  );
}

export function DepartmentReportCard({
  code,
  fullName,
  subtitle,
  records,
  bands,
}: {
  code: string;
  fullName: string;
  subtitle: string;
  records: StudentRecord[];
  bands: ScoreBand[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  const { data, total, avg, strongCount, supportCount, strongMin, supportMax, tierTotals } = useMemo(() => {
    const counts = new Map<string, number>();
    const tTotals = { support: 0, developing: 0, strong: 0 };
    for (const r of records) {
      const band = bandForScore(r.score, bands);
      if (!band) continue;
      counts.set(band.id, (counts.get(band.id) ?? 0) + 1);
      tTotals[band.tier]++;
    }
    const { strongMin, supportMax } = deriveTierThresholds(bands);
    const scores = records.map((r) => r.score);
    return {
      data: bands.map((b) => ({ label: b.label, count: counts.get(b.id) ?? 0, tier: b.tier })),
      total: records.length,
      avg: scores.length ? round1(mean(scores)) : 0,
      strongCount: records.filter((r) => r.score >= strongMin).length,
      supportCount: records.filter((r) => r.score <= supportMax).length,
      strongMin,
      supportMax,
      tierTotals: tTotals,
    };
  }, [records, bands]);

  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const maxTick = Math.max(4, Math.ceil((Math.max(1, ...data.map((d) => d.count)) * 1.25) / 4) * 4);

  return (
    <div ref={ref} className="card p-5 sm:p-6 bg-[var(--surface)] fade-in">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex gap-1 mb-2" aria-hidden="true">
            <span className="h-[3px] w-6 rounded-full" style={{ background: tierColor.strong.light }} />
            <span className="h-[3px] w-6 rounded-full" style={{ background: tierColor.developing.light }} />
            <span className="h-[3px] w-6 rounded-full" style={{ background: tierColor.support.light }} />
          </div>
          <h3 className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight leading-none">{code}</h3>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)] mt-1.5">{fullName}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => ref.current && exportChartPng(ref.current, `${code}-score-report`)}>
            <FileImage size={14} /> PNG
          </Button>
          <Button size="sm" variant="ghost" onClick={() => ref.current && exportChartPdf(ref.current, `${code}-score-report`)}>
            <Download size={14} /> PDF
          </Button>
        </div>
      </div>

      <h4 className="text-xl font-extrabold text-[var(--text-primary)]">Score distribution</h4>
      <p className="text-xs font-semibold text-[var(--text-secondary)] mb-4">{subtitle}</p>

      <div className="flex flex-wrap gap-2.5 mb-5">
        <Chip label="Total students" value={String(total)} accent="var(--accent)" soft="var(--accent-soft)" />
        <Chip label="Average score" value={String(avg)} accent="var(--violet)" soft="var(--violet-soft)" />
        <Chip label={`Scored ${strongMin} or above`} value={`${strongCount} (${pct(strongCount)}%)`} accent={tierColor.strong.light} soft="var(--status-good-soft)" />
        <Chip label={`Scored ${supportMax} or below`} value={`${supportCount} (${pct(supportCount)}%)`} accent={tierColor.support.light} soft="var(--status-critical-soft)" />
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Number of students</p>
        <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)]">
          {(["strong", "developing", "support"] as const).map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: TIER_META[t].color }} />
              {TIER_META[t].label}
            </span>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 20, right: 8, left: -12, bottom: 0 }} role="img" aria-label={`Score distribution for ${code}`}>
          <CartesianGrid stroke="var(--gridline)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} />
          <YAxis allowDecimals={false} domain={[0, maxTick]} tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} cursor={{ fill: "var(--accent-soft)" }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
            <LabelList dataKey="count" position="top" style={{ fontSize: 12, fontWeight: 700, fill: "var(--text-primary)" }} formatter={(v: number) => (v > 0 ? v : "")} />
            {data.map((d, i) => (
              <Cell key={i} fill={TIER_META[d.tier].color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)] mt-5 mb-2">Share of students by performance tier</p>
      <div className="flex h-11 rounded-lg overflow-hidden" role="img" aria-label="Share of students by performance tier">
        {(["support", "developing", "strong"] as const).map((t) => {
          const width = pct(tierTotals[t]);
          if (!width) return null;
          return (
            <div
              key={t}
              className="flex items-center justify-center px-2 text-[11px] font-bold text-center"
              style={{ width: `${width}%`, background: TIER_META[t].color, color: "#fff" }}
              title={`${TIER_META[t].label} · ${tierTotals[t]} students · ${width}%`}
            >
              {width >= 14 ? (
                <span className="truncate">
                  {TIER_META[t].label}
                  <span className="block font-medium opacity-90">
                    {tierTotals[t]} students · {width}%
                  </span>
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
        {(["support", "developing", "strong"] as const)
          .filter((t) => pct(tierTotals[t]) < 14 && tierTotals[t] > 0)
          .map((t) => (
            <p key={t} className="text-[11px] font-semibold" style={{ color: TIER_META[t].color }}>
              {TIER_META[t].label} · {tierTotals[t]} students · {pct(tierTotals[t])}%
            </p>
          ))}
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)]">
        <span>{code} students only</span>
        <span>
          Score bands: {bands[0]?.label}, then {bands[1]?.label} through {bands[bands.length - 1]?.label}
        </span>
      </div>
    </div>
  );
}
