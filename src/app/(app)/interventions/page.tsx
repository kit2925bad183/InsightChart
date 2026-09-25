"use client";

import { LifeBuoy } from "lucide-react";
import { useApp, useRecords } from "@/context/AppContext";
import { UploadArea } from "@/components/upload/UploadArea";
import { Card, CardHeader } from "@/components/ui/Card";

export default function InterventionsPage() {
  const { state } = useApp();
  const records = useRecords();
  const weakCount = records.filter((r) => r.score < state.thresholdSupport).length;

  if (!state.source) return <UploadArea />;

  return (
    <Card>
      <CardHeader title="Intervention Planner" subtitle="Create and track remedial sessions for weak students" />
      <div className="flex flex-col items-center text-center gap-3 py-10">
        <span className="rounded-full bg-[var(--accent-soft)] text-[var(--accent)] p-3">
          <LifeBuoy size={22} />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Coming in the next build phase</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md">
            You&apos;ll be able to select students from a chart or the {weakCount} currently below {state.thresholdSupport} marks,
            assign a staff member, and log a topic, date, action plan, and follow-up status — persisted independently of
            whichever assessment file is loaded.
          </p>
        </div>
      </div>
    </Card>
  );
}
