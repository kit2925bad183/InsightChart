"use client";

import Link from "next/link";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useApp, useRecords } from "@/context/AppContext";
import { Card, CardHeader } from "@/components/ui/Card";
import { computeBasicAlerts } from "@/lib/analysis/alerts";

export function ImportantAlertsCard() {
  const { state } = useApp();
  const records = useRecords();
  const alerts = computeBasicAlerts(records, state.thresholdSupport).slice(0, 4);

  return (
    <Card>
      <CardHeader title="Important alerts" subtitle="Auto-detected from the current dataset" actions={<Link href="/alerts" className="text-xs font-medium text-[var(--accent-strong)] hover:underline">View all</Link>} />
      {!alerts.length ? (
        <p className="text-sm text-[var(--text-muted)] flex items-center gap-2">
          <ShieldCheck size={16} className="text-[var(--status-good)]" /> Nothing needs attention right now.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {alerts.map((a) => (
            <li key={a.id}>
              <Link
                href={a.href}
                className="flex gap-2.5 rounded-lg p-1.5 -m-1.5 hover:bg-[var(--surface-muted)] transition-colors"
              >
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
