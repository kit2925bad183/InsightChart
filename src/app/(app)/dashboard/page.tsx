"use client";

import { useState } from "react";
import { useApp, useRecords } from "@/context/AppContext";
import { UploadArea } from "@/components/upload/UploadArea";
import { InlineWarnings } from "@/components/upload/UploadArea";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { ScoreDistributionChart } from "@/components/dashboard/ScoreDistributionChart";
import { RecentUploadsCard } from "@/components/dashboard/RecentUploadsCard";
import { ImportantAlertsCard } from "@/components/dashboard/ImportantAlertsCard";
import { StudentListModal, StudentDetailModal } from "@/components/dashboard/StudentModals";
import type { ScoreBand } from "@/lib/types";
import type { StudentRecord } from "@/lib/analysis/stats";

export default function DashboardPage() {
  const { state, activeSheet } = useApp();
  const records = useRecords();
  const [selectedBand, setSelectedBand] = useState<ScoreBand | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);

  if (state.status === "loading") {
    return <div className="card p-10 text-center text-sm text-[var(--text-secondary)] fade-in">Reading your file…</div>;
  }

  if (!activeSheet) {
    return <UploadArea />;
  }

  const bandStudents = selectedBand ? records.filter((r) => r.score >= selectedBand.min && r.score <= selectedBand.max) : [];

  return (
    <>
      {state.source && <InlineWarnings warnings={state.source.warnings} />}
      <SummaryCards records={records} supportThreshold={state.thresholdSupport} strongThreshold={state.thresholdStrong} />
      <ScoreDistributionChart records={records} bands={state.scoreBands} onSelectBand={setSelectedBand} />
      <div className="grid md:grid-cols-2 gap-6">
        <RecentUploadsCard />
        <ImportantAlertsCard />
      </div>

      {selectedBand && (
        <StudentListModal
          band={selectedBand}
          students={bandStudents}
          onClose={() => setSelectedBand(null)}
          onSelectStudent={(s) => setSelectedStudent(s)}
          extraFields={activeSheet.headers}
        />
      )}
      {selectedStudent && <StudentDetailModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />}
    </>
  );
}
