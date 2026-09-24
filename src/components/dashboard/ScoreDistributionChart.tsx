"use client";

import { useMemo, useRef } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ScoreBand } from "@/lib/types";
import type { StudentRecord } from "@/lib/analysis/stats";
import { bandForScore } from "@/lib/analysis/scoreBands";
import { tierColorVar } from "@/lib/palette";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Download, FileImage } from "lucide-react";
import { exportChartPdf, exportChartPng, exportRowsCsv } from "@/lib/export";

function TierDot({ tier }: { tier: "support" | "developing" | "strong" }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: tierColorVar[tier] }} />;
}

interface TooltipPayloadItem {
  payload: { label: string; count: number; tier: "support" | "developing" | "strong" };
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const tierLabel = d.tier === "support" ? "Needs support" : d.tier === "developing" ? "Developing" : "Strong";
  return (
    <div className="card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-[var(--text-primary)]">{d.label} marks</p>
      <p className="text-[var(--text-secondary)] flex items-center gap-1.5 mt-0.5">
        <TierDot tier={d.tier} /> {d.count} student{d.count === 1 ? "" : "s"} · {tierLabel}
      </p>
    </div>
  );
}

export function ScoreDistributionChart({
  records,
  bands,
  onSelectBand,
}: {
  records: StudentRecord[];
  bands: ScoreBand[];
  onSelectBand: (band: ScoreBand) => void;
}) {
  const chartRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of records) {
      const band = bandForScore(r.score, bands);
      if (!band) continue;
      counts.set(band.id, (counts.get(band.id) ?? 0) + 1);
    }
    return bands.map((b) => ({ id: b.id, label: b.label, count: counts.get(b.id) ?? 0, tier: b.tier, band: b }));
  }, [records, bands]);

  return (
    <Card>
      <CardHeader
        title="Score distribution"
        subtitle="Click a bar to see every student in that range"
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => chartRef.current && exportChartPng(chartRef.current, "score-distribution")}>
              <FileImage size={14} /> PNG
            </Button>
            <Button size="sm" variant="ghost" onClick={() => chartRef.current && exportChartPdf(chartRef.current, "score-distribution")}>
              <Download size={14} /> PDF
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                exportRowsCsv(
                  data.map((d) => ({ "Score band": d.label, "Student count": d.count, Tier: d.tier })),
                  "score-distribution"
                )
              }
            >
              CSV
            </Button>
          </>
        }
      />
      <div ref={chartRef} className="bg-[var(--surface)]">
        <div className="flex items-center gap-4 mb-2 text-[11px] text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <TierDot tier="strong" /> Strong
          </span>
          <span className="flex items-center gap-1.5">
            <TierDot tier="developing" /> Developing
          </span>
          <span className="flex items-center gap-1.5">
            <TierDot tier="support" /> Needs support
          </span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} role="img" aria-label="Bar chart of student count per score band">
            <CartesianGrid stroke="var(--gridline)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--accent-soft)" }} />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              maxBarSize={56}
              onClick={(d: { band: ScoreBand }) => onSelectBand(d.band)}
              cursor="pointer"
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.id} fill={tierColorVar[d.tier]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
