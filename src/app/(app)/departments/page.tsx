"use client";

import { useApp, useRecords } from "@/context/AppContext";
import { UploadArea } from "@/components/upload/UploadArea";
import { DepartmentAnalysis } from "@/components/dashboard/DepartmentAnalysis";
import { DepartmentReports } from "@/components/dashboard/DepartmentReports";
import { DepartmentComparisonTable } from "@/components/dashboard/DepartmentComparisonTable";
import { AssessmentComparison } from "@/components/dashboard/AssessmentComparison";
import { deriveAssessmentTitle } from "@/lib/analysis/reportMeta";

export default function DepartmentsPage() {
  const { state, activeSheet } = useApp();
  const records = useRecords();

  if (!activeSheet) return <UploadArea />;

  return (
    <>
      <DepartmentAnalysis allRecords={records} supportThreshold={state.thresholdSupport} strongThreshold={state.thresholdStrong} />
      <DepartmentComparisonTable records={records} passThreshold={state.thresholdStrong} />
      <DepartmentReports records={records} bands={state.scoreBands} subtitle={deriveAssessmentTitle(state.source?.fileName ?? "")} />
      <AssessmentComparison
        resetToken={state.loadNonce}
        fileALabel={deriveAssessmentTitle(state.source?.fileName ?? "This assessment") || "This assessment"}
        recordsA={records}
        normalizeDepartments={state.normalizeDepartments}
      />
    </>
  );
}
