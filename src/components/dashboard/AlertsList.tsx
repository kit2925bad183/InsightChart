"use client";

import Link from "next/link";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { StudentRecord } from "@/lib/analysis/stats";
import { computeBasicAlerts } from "@/lib/analysis/alerts";
import { Card, CardHeader } from "@/components/ui/Card";

export function AlertsList({ records, thresholdSupport }: { records: StudentRecord[]; thresholdSupport: number }) {
  const alerts = computeBasicAlerts(records, thresholdSupport);

  return (
    <Card>
      <CardHeader
        title="Alerts"
        subtitle="Low scores and weak departments, detected automatically — missing marks, duplicate records, and deadline alerts arrive once Tasks & Interventions are tracked"
      />
      {!alerts.length ? (
        <p className="text-sm text-[var(--text-muted)] flex items-center gap-2">
          <ShieldCheck size={16} className="text-[var(--status-good)]" /> No alerts right now.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {alerts.map((a) => (
            <li key={a.id}>
              <Link href={a.href} className="flex gap-2.5 rounded-lg p-2 -m-2 hover:bg-[var(--surface-muted)] transition-colors">
                <span
                  className="rounded-lg p-1.5 h-fit shrink-0"
                  style={{
                    background: a.severity === "critical" ? "var(--status-critical-soft)" : "var(--status-warning-soft)",
                    color: a.severity === "critical" ? "var(--status-critical)" : "var(--status-warning)",
                  }}
                >
                  <AlertTriangle size={14} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] break-words">{a.title}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">{a.detail}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
