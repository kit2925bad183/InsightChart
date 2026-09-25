"use client";

import { ShieldCheck } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { UploadArea } from "@/components/upload/UploadArea";
import { Card, CardHeader } from "@/components/ui/Card";

export default function PlacementPage() {
  const { state } = useApp();
  if (!state.source) return <UploadArea />;

  return (
    <Card>
      <CardHeader title="Placement Readiness" subtitle="Track aptitude, reasoning, technical skills, communication, resume completion, and mock-interview scores" />
      <div className="flex flex-col items-center text-center gap-3 py-10">
        <span className="rounded-full bg-[var(--accent-soft)] text-[var(--accent)] p-3">
          <ShieldCheck size={22} />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Coming in the next build phase</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md">
            Enter placement-readiness metrics per student, see a readiness level, and filter to who still needs placement
            training — this data is independent of the assessment file and persists across resets.
          </p>
        </div>
      </div>
    </Card>
  );
}
