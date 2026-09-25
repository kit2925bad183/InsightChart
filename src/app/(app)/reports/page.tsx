"use client";

import { useState } from "react";
import { Share2, Table2, FileSpreadsheet } from "lucide-react";
import { downloadFromApi } from "@/lib/api";
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
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // Published datasets download through the authenticated export API; the built-in
  // sample data (never stored on the server) is exported in the browser.
  const onServer = state.datasetVersion !== null;
  const serverCsv = (format: "students" | "raw") => {
    setDownloadError(null);
    downloadFromApi(`/api/dataset/export?format=${format}`, `insightchart-${format}.csv`).catch((err) =>
      setDownloadError(err instanceof Error ? err.message : "Download failed.")
    );
  };

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
            onServer
              ? serverCsv("students")
              : exportRowsCsv(
              records.map((r) => ({ Name: r.name, Registration: r.registration, Department: r.department, Score: r.score })),
              `insightchart-${label.replace(/[^a-z0-9]+/gi, "-") || "data"}`
            )
          }
        >
          <Table2 size={15} /> Export all students as CSV
        </Button>
        {onServer && (
          <Button variant="outline" onClick={() => serverCsv("raw")}>
            <FileSpreadsheet size={15} /> Download full data sheet (CSV)
          </Button>
        )}
      </div>
      {downloadError && (
        <p role="alert" className="text-xs text-[var(--status-critical)] mt-3">
          {downloadError}
        </p>
      )}
      <p className="text-xs text-[var(--text-muted)] mt-4">
        The shareable HTML report is a single self-contained file — click-a-bar-to-see-students works for whoever opens it,
        no InsightChart access needed. Per-chart PNG/PDF exports are available next to each chart on the Charts and
        Department Comparison pages.
      </p>
    </Card>
  );
}
