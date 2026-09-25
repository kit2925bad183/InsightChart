"use client";

import { CalendarClock } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";

export default function TasksPage() {
  return (
    <Card>
      <CardHeader title="Tasks & Calendar" subtitle="Report deadlines, assessment dates, remedial classes, parent meetings, and department events" />
      <div className="flex flex-col items-center text-center gap-3 py-10">
        <span className="rounded-full bg-[var(--accent-soft)] text-[var(--accent)] p-3">
          <CalendarClock size={22} />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Coming in the next build phase</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md">
            A task list and month calendar for staff deadlines and events — stored independently of whichever
            assessment file is loaded, so it survives a reset or a new upload.
          </p>
        </div>
      </div>
    </Card>
  );
}
