"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, RefreshCcw, History, X, FileDown, Loader2, Share2 } from "lucide-react";
import { clearSession } from "@/lib/persistence";
import { exportMultiPagePdf } from "@/lib/export";
import { downloadInteractiveReport } from "@/lib/htmlReport";
import { useApp } from "@/context/AppContext";
import { UploadArea, InlineWarnings } from "@/components/upload/UploadArea";
import { DataPreviewTable } from "@/components/data/DataPreviewTable";
import { MappingPanel } from "@/components/mapping/MappingPanel";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { ScoreDistributionChart } from "@/components/dashboard/ScoreDistributionChart";
import { StudentListModal, StudentDetailModal } from "@/components/dashboard/StudentModals";
import { DepartmentAnalysis } from "@/components/dashboard/DepartmentAnalysis";
import { DepartmentReports } from "@/components/dashboard/DepartmentReports";
import { AssessmentComparison } from "@/components/dashboard/AssessmentComparison";
import { deriveAssessmentTitle } from "@/lib/analysis/reportMeta";
import { ChartWorkspace } from "@/components/dashboard/ChartWorkspace";
import { NaturalLanguageBox } from "@/components/dashboard/NaturalLanguageBox";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { ColumnInsights } from "@/components/dashboard/ColumnInsights";
import { SettingsPanel } from "@/components/dashboard/SettingsPanel";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toStudentRecords, type StudentRecord } from "@/lib/analysis/stats";
import type { ScoreBand } from "@/lib/types";

export function DashboardShell() {
  const { state, activeSheet, dispatch } = useApp();
  const [selectedBand, setSelectedBand] = useState<ScoreBand | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
  const overviewRef = useRef<HTMLDivElement>(null);
  const deptAnalysisRef = useRef<HTMLDivElement>(null);
  const insightsRef = useRef<HTMLDivElement>(null);

  const exportFullReport = async () => {
    setExportingReport(true);
    try {
      const nodes: HTMLElement[] = [];
      if (overviewRef.current) nodes.push(overviewRef.current);
      if (deptAnalysisRef.current) nodes.push(deptAnalysisRef.current);
      document.querySelectorAll<HTMLElement>("[data-report-card]").forEach((el) => nodes.push(el));
      if (insightsRef.current) nodes.push(insightsRef.current);
      await exportMultiPagePdf(nodes, `insightchart-report-${deriveAssessmentTitle(state.source?.fileName ?? "report").replace(/[^a-z0-9]+/gi, "-")}`);
    } finally {
      setExportingReport(false);
    }
  };

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
            state.normalizeDepartments,
            state.departmentOverrides
          )
        : [],
    [
      activeSheet,
      state.mapping.studentName,
      state.mapping.registration,
      state.mapping.department,
      state.mapping.numeric,
      state.normalizeDepartments,
      state.departmentOverrides,
    ]
  );

  const bandStudents = selectedBand ? records.filter((r) => r.score >= selectedBand.min && r.score <= selectedBand.max) : [];

  const exportInteractiveHtml = () => {
    const label = deriveAssessmentTitle(state.source?.fileName ?? "report");
    downloadInteractiveReport(
      {
        title: label || "Score Report",
        subtitle: state.source?.fileName ?? "",
        students: records.map((r) => ({ name: r.name, registration: r.registration, department: r.department, score: r.score })),
        bands: state.scoreBands,
      },
      `insightchart-${label.replace(/[^a-z0-9]+/gi, "-") || "report"}`
    );
  };

  // "/" focuses the data-preview search, "u" opens the upload picker — ignored while
  // typing anywhere else so normal text entry (including "/" or "u" in a search box) works.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("insightchart:focus-search"));
      } else if (e.key === "u") {
        window.dispatchEvent(new CustomEvent("insightchart:trigger-upload"));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
            {state.status === "ready" && (
              <Button size="sm" variant="ghost" onClick={exportFullReport} disabled={exportingReport} aria-label="Export full report as PDF">
                {exportingReport ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                {exportingReport ? "Exporting…" : "Full report"}
              </Button>
            )}
            {state.status === "ready" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={exportInteractiveHtml}
                aria-label="Download a shareable interactive HTML report"
                title="Download a standalone HTML file — click-a-bar-to-see-students works for whoever you send it to, no InsightChart needed"
              >
                <Share2 size={14} /> Shareable HTML
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => (state.source?.kind === "mock" ? dispatch({ type: "RESET" }) : setShowResetConfirm(true))}
              aria-label="Reset to sample data"
            >
              <RefreshCcw size={14} /> Reset
            </Button>
            <ThemeToggle />
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
            {state.restoredNotice && (
              <div className="flex items-center gap-2.5 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2.5 text-xs text-[var(--accent-strong)] fade-in">
                <History size={15} className="shrink-0" />
                <span className="flex-1">Restored your previous session — &quot;{state.source?.fileName}&quot; and your settings, from this browser.</span>
                <button
                  onClick={() => dispatch({ type: "DISMISS_RESTORED_NOTICE" })}
                  aria-label="Dismiss"
                  className="rounded p-0.5 hover:bg-white/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {state.source && <InlineWarnings warnings={state.source.warnings} />}

            <div ref={overviewRef} className="space-y-6">
              <SummaryCards records={records} supportThreshold={state.thresholdSupport} strongThreshold={state.thresholdStrong} />
              <ScoreDistributionChart records={records} bands={state.scoreBands} onSelectBand={setSelectedBand} />
            </div>

            <div ref={deptAnalysisRef}>
              <DepartmentAnalysis
                key={state.loadNonce}
                allRecords={records}
                supportThreshold={state.thresholdSupport}
                strongThreshold={state.thresholdStrong}
              />
            </div>

            <DepartmentReports
              records={records}
              bands={state.scoreBands}
              subtitle={deriveAssessmentTitle(state.source?.fileName ?? "")}
            />

            <AssessmentComparison
              key={state.loadNonce}
              fileALabel={deriveAssessmentTitle(state.source?.fileName ?? "This assessment") || "This assessment"}
              recordsA={records}
              normalizeDepartments={state.normalizeDepartments}
            />

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <MappingPanel />
                <ChartWorkspace />
              </div>
              <div className="space-y-6">
                <NaturalLanguageBox key={state.loadNonce} records={records} />
                <div ref={insightsRef}>
                  <InsightsPanel records={records} bands={state.scoreBands} supportThreshold={state.thresholdSupport} />
                </div>
                <ColumnInsights key={state.loadNonce} />
                <SettingsPanel />
              </div>
            </div>

            <DataPreviewTable key={state.loadNonce} />
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

      {showResetConfirm && (
        <ConfirmDialog
          title="Reset to sample data?"
          message={`This clears "${state.source?.fileName ?? "your file"}", all mapping/threshold/chart customization, and the saved copy in this browser — this can't be undone.`}
          confirmLabel="Reset"
          onCancel={() => setShowResetConfirm(false)}
          onConfirm={() => {
            dispatch({ type: "RESET" });
            clearSession();
            setShowResetConfirm(false);
          }}
        />
      )}
    </div>
  );
}
