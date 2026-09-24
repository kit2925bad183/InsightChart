"use client";

import { Users, TrendingUp, ArrowUpCircle, ArrowDownCircle, ShieldCheck, LifeBuoy } from "lucide-react";
import type { StudentRecord } from "@/lib/analysis/stats";
import { mean, round1 } from "@/lib/analysis/stats";

function StatCard({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "good" | "critical";
}) {
  const toneClass =
    tone === "good" ? "text-[var(--status-good)]" : tone === "critical" ? "text-[var(--status-critical)]" : "text-[var(--accent)]";
  return (
    <div className="card p-4 flex items-center gap-3 fade-in">
      <div className={`rounded-xl bg-[var(--accent-soft)] p-2.5 ${toneClass}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[var(--text-muted)] truncate">{label}</p>
        <p className="text-xl font-semibold text-[var(--text-primary)] tabular leading-tight">{value}</p>
      </div>
    </div>
  );
}

export function SummaryCards({
  records,
  supportThreshold,
  strongThreshold,
}: {
  records: StudentRecord[];
  supportThreshold: number;
  strongThreshold: number;
}) {
  if (!records.length) {
    return (
      <div className="card p-6 text-center text-sm text-[var(--text-muted)]">
        Map a numeric score column to see summary statistics.
      </div>
    );
  }

  const scores = records.map((r) => r.score);
  const avg = mean(scores);
  const highest = Math.max(...scores);
  const lowest = Math.min(...scores);
  const above = records.filter((r) => r.score >= strongThreshold).length;
  const below = records.filter((r) => r.score < supportThreshold).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <StatCard icon={<Users size={18} />} label="Total students" value={String(records.length)} />
      <StatCard icon={<TrendingUp size={18} />} label="Average score" value={round1(avg).toString()} />
      <StatCard icon={<ArrowUpCircle size={18} />} label="Highest score" value={String(highest)} tone="good" />
      <StatCard icon={<ArrowDownCircle size={18} />} label="Lowest score" value={String(lowest)} tone="critical" />
      <StatCard icon={<ShieldCheck size={18} />} label={`Above ${strongThreshold}`} value={String(above)} tone="good" />
      <StatCard icon={<LifeBuoy size={18} />} label={`Below ${supportThreshold}`} value={String(below)} tone="critical" />
    </div>
  );
}
