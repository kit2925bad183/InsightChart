"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { categorical, tierColor } from "@/lib/palette";
import { DEFAULT_BANDS } from "@/lib/analysis/scoreBands";
import type { ScoreBand } from "@/lib/types";

const TIER_OPTIONS: ScoreBand["tier"][] = ["support", "developing", "strong"];

export function SettingsPanel() {
  const { state, dispatch } = useApp();
  const [expanded, setExpanded] = useState(false);

  const updateBand = (id: string, patch: Partial<ScoreBand>) => {
    dispatch({ type: "SET_BANDS", bands: state.scoreBands.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  };

  return (
    <Card>
      <CardHeader
        title="Thresholds, bands & colours"
        subtitle="Tune how performance is measured and displayed"
        actions={
          <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide bands" : "Edit bands"}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-secondary)]">
          Support threshold (below)
          <input
            type="number"
            value={state.thresholdSupport}
            onChange={(e) => dispatch({ type: "SET_THRESHOLDS", support: Number(e.target.value), strong: state.thresholdStrong })}
            className="text-sm rounded-lg border border-[var(--border-strong)] bg-white px-2.5 py-1.5 tabular"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-secondary)]">
          Strong threshold (at/above)
          <input
            type="number"
            value={state.thresholdStrong}
            onChange={(e) => dispatch({ type: "SET_THRESHOLDS", support: state.thresholdSupport, strong: Number(e.target.value) })}
            className="text-sm rounded-lg border border-[var(--border-strong)] bg-white px-2.5 py-1.5 tabular"
          />
        </label>
      </div>

      <label className="flex items-center justify-between gap-3 mb-4 text-xs font-medium text-[var(--text-secondary)]">
        <span>
          Smart-group department names
          <span className="block text-[10px] font-normal text-[var(--text-muted)]">Merges messy free-text variants (e.g. &quot;CSE(AI&amp;ML)&quot;, &quot;4th year/AIDS&quot;) into clean branch codes</span>
        </span>
        <input
          type="checkbox"
          checked={state.normalizeDepartments}
          onChange={() => dispatch({ type: "TOGGLE_NORMALIZE_DEPARTMENTS" })}
          className="h-4 w-4 accent-[var(--accent)] shrink-0"
        />
      </label>

      <p className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">Custom chart colour</p>
      <div className="flex items-center gap-1.5 mb-1">
        {categorical.light.map((c, i) => (
          <button
            key={c}
            aria-label={`Use colour ${i + 1}`}
            aria-pressed={state.chartAccentIndex === i}
            onClick={() => dispatch({ type: "SET_ACCENT", index: i })}
            className="h-6 w-6 rounded-full border-2 transition-transform"
            style={{ background: c, borderColor: state.chartAccentIndex === i ? "var(--text-primary)" : "transparent", transform: state.chartAccentIndex === i ? "scale(1.1)" : undefined }}
          />
        ))}
      </div>

      {expanded && (
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-[var(--text-secondary)]">Score bands</p>
            <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "SET_BANDS", bands: DEFAULT_BANDS })}>
              <RotateCcw size={12} /> Reset
            </Button>
          </div>
          <div className="space-y-1.5">
            {state.scoreBands.map((b) => (
              <div key={b.id} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: tierColor[b.tier].light }} />
                <input
                  value={b.label}
                  onChange={(e) => updateBand(b.id, { label: e.target.value })}
                  className="w-16 rounded border border-[var(--border)] px-1.5 py-1"
                  aria-label={`Label for band ${b.label}`}
                />
                <input
                  type="number"
                  value={b.min}
                  onChange={(e) => updateBand(b.id, { min: Number(e.target.value) })}
                  className="w-14 rounded border border-[var(--border)] px-1.5 py-1 tabular"
                  aria-label={`Minimum for band ${b.label}`}
                />
                <span className="text-[var(--text-muted)]">–</span>
                <input
                  type="number"
                  value={b.max}
                  onChange={(e) => updateBand(b.id, { max: Number(e.target.value) })}
                  className="w-14 rounded border border-[var(--border)] px-1.5 py-1 tabular"
                  aria-label={`Maximum for band ${b.label}`}
                />
                <select
                  value={b.tier}
                  onChange={(e) => updateBand(b.id, { tier: e.target.value as ScoreBand["tier"] })}
                  className="rounded border border-[var(--border)] px-1.5 py-1"
                  aria-label={`Performance tier for band ${b.label}`}
                >
                  {TIER_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
