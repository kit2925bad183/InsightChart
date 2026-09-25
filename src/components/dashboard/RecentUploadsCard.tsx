"use client";

import { History } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Card, CardHeader } from "@/components/ui/Card";

/** Phase 1: shows only the currently loaded file — a real multi-upload history log
 * (IndexedDB-backed, capped at the last 10 uploads) lands in Phase 2 and this card
 * switches to reading from it. */
export function RecentUploadsCard() {
  const { state } = useApp();
  const source = state.source;

  return (
    <Card>
      <CardHeader title="Recent uploads" subtitle="Files loaded in this session" />
      {!source ? (
        <p className="text-sm text-[var(--text-muted)]">No file loaded yet.</p>
      ) : (
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] p-1.5 shrink-0">
            <History size={14} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--text-primary)] truncate">
              {source.kind === "mock" ? "Sample data" : source.fileName}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {source.sheets.reduce((n, s) => n + s.rows.length, 0)} rows · {source.sheets.length} sheet{source.sheets.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
