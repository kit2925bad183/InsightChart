"use client";

import { useMemo, useState } from "react";
import { BarChart3, RefreshCcw } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { UploadArea, InlineWarnings } from "@/components/upload/UploadArea";
import { DataPreviewTable } from "@/components/data/DataPreviewTable";
import { MappingPanel } from "@/components/mapping/MappingPanel";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { ScoreDistributionChart } from "@/components/dashboard/ScoreDistributionChart";
import { StudentListModal, StudentDetailModal } from "@/components/dashboard/StudentModals";
import { DepartmentAnalysis } from "@/components/dashboard/DepartmentAnalysis";
import { DepartmentReports } from "@/components/dashboard/DepartmentReports";
import { deriveAssessmentTitle } from "@/lib/analysis/reportMeta";
import { ChartWorkspace } from "@/components/dashboard/ChartWorkspace";
import { NaturalLanguageBox } from "@/components/dashboard/NaturalLanguageBox";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { SettingsPanel } from "@/components/dashboard/SettingsPanel";
import { Button } from "@/components/ui/Button";
import { toStudentRecords, type StudentRecord } from "@/lib/analysis/stats";
import type { ScoreBand } from "@/lib/types";

export function DashboardShell() {
  const { state, activeSheet, dispatch } = useApp();
  const [selectedBand, setSelectedBand] = useState<ScoreBand | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);

  const records = useMemo(
    () =>
      activeSheet
        ? toStudentRecords(
            activeSheet,
            {
              studentName: state.mapping.studentName,
              registration: state.mapping.registration,
              department: state.mapping.department,
              numeric: state.mapping.numeric,
            },
            state.normalizeDepartments
          )
        : [],
    [
      activeSheet,
      state.mapping.studentName,
      state.mapping.registration,
      state.mapping.department,
      state.mapping.numeric,
      state.normalizeDepartments,
    ]
  );

  const bandStudents = selectedBand ? records.filter((r) => r.score >= selectedBand.min && r.score <= selectedBand.max) : [];

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-[var(--accent)] text-white p-1.5">
              <BarChart3 size={18} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[var(--text-primary)] leading-none">InsightChart</h1>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {state.source?.kind === "mock" ? "Sample data — upload your own file" : state.source?.fileName ?? "No file loaded"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "RESET" })} aria-label="Reset to sample data">
              <RefreshCcw size={14} /> Reset
            </Button>
            <UploadArea compact />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {state.status === "loading" && (
          <div className="card p-10 text-center text-sm text-[var(--text-secondary)] fade-in">Reading your file…</div>
        )}

        {state.status === "error" && (
          <div className="space-y-4 fade-in">
            <div className="card p-6 text-center">
              <p className="text-sm font-semibold text-[var(--status-critical)]">{state.errorMessage ?? "Could not read this file."}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Try a different file, or check the format is supported.</p>
            </div>
            <UploadArea />
          </div>
        )}

        {state.status !== "loading" && !activeSheet && state.status !== "error" && (
          <div className="space-y-4">
            <UploadArea />
          </div>
        )}

        {state.status === "ready" && activeSheet && (
          <>
            {state.source && <InlineWarnings warnings={state.source.warnings} />}

            <SummaryCards records={records} supportThreshold={state.thresholdSupport} strongThreshold={state.thresholdStrong} />

            <ScoreDistributionChart records={records} bands={state.scoreBands} onSelectBand={setSelectedBand} />

            <DepartmentAnalysis allRecords={records} supportThreshold={state.thresholdSupport} strongThreshold={state.thresholdStrong} />

            <DepartmentReports
              records={records}
              bands={state.scoreBands}
              subtitle={deriveAssessmentTitle(state.source?.fileName ?? "")}
            />

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <MappingPanel />
                <ChartWorkspace />
              </div>
              <div className="space-y-6">
                <NaturalLanguageBox records={records} />
                <InsightsPanel records={records} bands={state.scoreBands} supportThreshold={state.thresholdSupport} />
                <SettingsPanel />
              </div>
            </div>

            <DataPreviewTable />
          </>
        )}
      </main>

      <footer className="border-t border-[var(--border)] py-4">
        <p className="text-center text-[11px] text-[var(--text-muted)]">
          InsightChart processes files locally in your browser — nothing is uploaded to a server.
        </p>
      </footer>

      {selectedBand && (
        <StudentListModal
          band={selectedBand}
          students={bandStudents}
          onClose={() => setSelectedBand(null)}
          onSelectStudent={(s) => setSelectedStudent(s)}
          extraFields={activeSheet?.headers ?? []}
        />
      )}
      {selectedStudent && <StudentDetailModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />}
    </div>
  );
}
