"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { Card, CardHeader } from "@/components/ui/Card";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";
import { analyzeColumn } from "@/lib/analysis/columnInsights";
import { categorical } from "@/lib/palette";

/** Lets the user inspect any column — typically individual question columns in an
 * assessment export — that isn't already surfaced elsewhere in the dashboard. */
export function ColumnInsights() {
  const { state, activeSheet } = useApp();
  const [column, setColumn] = useState<string | undefined>();

  const mappedKeys = new Set(
    [state.mapping.category, state.mapping.numeric, state.mapping.studentName, state.mapping.registration, state.mapping.department, state.mapping.dateColumn].filter(Boolean)
  );
  const options: ComboboxOption[] = (activeSheet?.headers ?? []).filter((h) => !mappedKeys.has(h)).map((h) => ({ value: h, label: h }));

  const insight = useMemo(() => (activeSheet && column ? analyzeColumn(activeSheet, column) : null), [activeSheet, column]);

  if (!activeSheet || !options.length) return null;

  return (
    <Card>
      <CardHeader title="Column insights" subtitle="Inspect any other column — e.g. an individual question — for answer patterns" />
      <Combobox label="Column" value={column} onChange={setColumn} options={options} placeholder="Choose a column…" />

      {insight && (
        <div className="mt-4 fade-in">
          {insight.isNumeric ? (
            <div className="grid grid-cols-4 gap-2 text-center">
              <Stat label="Responses" value={String(insight.responseCount)} />
              <Stat label="Min" value={String(insight.min)} />
              <Stat label="Average" value={String(insight.avg)} />
              <Stat label="Max" value={String(insight.max)} />
            </div>
          ) : (
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-2">
                {insight.responseCount} responses · {insight.distinctCount} distinct answer{insight.distinctCount === 1 ? "" : "s"}
              </p>
              <div className="space-y-1.5">
                {insight.topAnswers?.map((a, i) => (
                  <div key={a.value} className="flex items-center gap-2 text-xs">
                    <span className="w-24 truncate text-[var(--text-primary)] font-medium" title={a.value}>
                      {a.value}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--surface-muted,#f2f6fc)] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${a.pct}%`, background: categorical.light[i % categorical.light.length] }} />
                    </div>
                    <span className="w-16 text-right tabular text-[var(--text-muted)]">
                      {a.count} · {a.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-muted,#f2f6fc)] py-2">
      <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
      <p className="text-sm font-semibold text-[var(--text-primary)] tabular">{value}</p>
    </div>
  );
}
