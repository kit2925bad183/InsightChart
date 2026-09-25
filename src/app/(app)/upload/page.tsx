"use client";

import { useState } from "react";
import { RefreshCcw } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { clearSession } from "@/lib/persistence";
import { UploadArea, InlineWarnings } from "@/components/upload/UploadArea";
import { MappingPanel } from "@/components/mapping/MappingPanel";
import { DataPreviewTable } from "@/components/data/DataPreviewTable";
import { ColumnInsights } from "@/components/dashboard/ColumnInsights";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function UploadPage() {
  const { state, dispatch, activeSheet } = useApp();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Upload & data preview</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {state.source?.kind === "mock" ? "Sample data — upload your own file" : state.source?.fileName ?? "No file loaded"}
          </p>
        </div>
        {activeSheet && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => (state.source?.kind === "mock" ? dispatch({ type: "RESET" }) : setShowResetConfirm(true))}
          >
            <RefreshCcw size={14} /> Reset to sample data
          </Button>
        )}
      </div>

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

      {state.status !== "loading" && !activeSheet && state.status !== "error" && <UploadArea />}

      {activeSheet && (
        <>
          {state.source && <InlineWarnings warnings={state.source.warnings} />}
          <UploadArea />
          <MappingPanel />
          <ColumnInsights />
          <DataPreviewTable />
        </>
      )}

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
    </>
  );
}
