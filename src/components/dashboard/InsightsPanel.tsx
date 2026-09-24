"use client";

import { Lightbulb } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { buildInsights } from "@/lib/analysis/insights";
import type { StudentRecord } from "@/lib/analysis/stats";
import type { ScoreBand } from "@/lib/types";

export function InsightsPanel({
  records,
  bands,
  supportThreshold,
}: {
  records: StudentRecord[];
  bands: ScoreBand[];
  supportThreshold: number;
}) {
  const insights = buildInsights(records, bands, supportThreshold);

  return (
    <Card>
      <CardHeader title="Insights" subtitle="Automatic findings from the current data" />
      {!insights.length ? (
        <p className="text-sm text-[var(--text-muted)]">Map a score column to generate insights.</p>
      ) : (
        <ul className="space-y-3">
          {insights.map((ins) => (
            <li key={ins.id} className="flex gap-2.5">
              <span className="rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] p-1.5 h-fit">
                <Lightbulb size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[var(--text-muted)]">{ins.label}</p>
                <p className="text-sm font-semibold text-[var(--text-primary)] break-words">{ins.value}</p>
                {ins.detail && <p className="text-[11px] text-[var(--text-secondary)]">{ins.detail}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
