"use client";

import { Share2, Table2 } from "lucide-react";
import { useApp, useRecords } from "@/context/AppContext";
import { UploadArea } from "@/components/upload/UploadArea";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { downloadInteractiveReport } from "@/lib/htmlReport";
import { exportRowsCsv } from "@/lib/export";
import { deriveAssessmentTitle } from "@/lib/analysis/reportMeta";

/** Phase 1: the two exports that don't depend on capturing DOM elements from other
 * routes (that pattern — a printable container assembled from checkbox-selected
 * sections — is Phase 3's ReportBuilder). Per-chart PNG/PDF export buttons already
 * live next to each chart on their own pages (Charts, Department reports). */
export default function ReportsPage() {
  const { state } = useApp();
  const records = useRecords();

  if (!state.source) return <UploadArea />;

  const label = deriveAssessmentTitle(state.source.fileName ?? "report");

  return (
    <Card>
      <CardHeader title="Reports & exports" subtitle="Download a shareable report or the raw data" />
      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          onClick={() =>
            downloadInteractiveReport(
              {
                title: label || "Score Report",
                subtitle: state.source?.fileName ?? "",
                students: records.map((r) => ({ name: r.name, registration: r.registration, department: r.department, score: r.score })),
                bands: state.scoreBands,
              },
              `insightchart-${label.replace(/[^a-z0-9]+/gi, "-") || "report"}`
            )
          }
        >
          <Share2 size={15} /> Shareable HTML report
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            exportRowsCsv(
              records.map((r) => ({ Name: r.name, Registration: r.registration, Department: r.department, Score: r.score })),
              `insightchart-${label.replace(/[^a-z0-9]+/gi, "-") || "data"}`
            )
          }
        >
          <Table2 size={15} /> Export all students as CSV
        </Button>
      </div>
      <p className="text-xs text-[var(--text-muted)] mt-4">
        The shareable HTML report is a single self-contained file — click-a-bar-to-see-students works for whoever opens it,
        no InsightChart access needed. Per-chart PNG/PDF exports are available next to each chart on the Charts and
        Department Comparison pages.
      </p>
    </Card>
  );
}
