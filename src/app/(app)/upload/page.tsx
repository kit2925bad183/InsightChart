"use client";

import { useState } from "react";
import { RefreshCcw } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { UploadArea, InlineWarnings } from "@/components/upload/UploadArea";
import { MappingPanel } from "@/components/mapping/MappingPanel";
import { DataPreviewTable } from "@/components/data/DataPreviewTable";
import { ColumnInsights } from "@/components/dashboard/ColumnInsights";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function UploadPage() {
  const { state, dispatch, activeSheet, canEdit, resetDataset } = useApp();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{canEdit ? "Upload & data preview" : "Data preview"}</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {state.source?.kind === "mock"
              ? canEdit
                ? "Sample data — upload your own file"
                : "Sample data — no dataset has been published yet"
              : state.source?.fileName ?? "No file loaded"}
          </p>
        </div>
        {canEdit && activeSheet && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => (state.source?.kind === "mock" ? dispatch({ type: "RESET" }) : setShowResetConfirm(true))}
          >
            <RefreshCcw size={14} /> Reset to sample data
          </Button>
        )}
      </div>
      {resetError && (
        <p role="alert" className="text-xs text-[var(--status-critical)]">
          {resetError}
        </p>
      )}

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
          {canEdit && <UploadArea />}
          <MappingPanel />
          <ColumnInsights />
          <DataPreviewTable />
        </>
      )}

      {showResetConfirm && (
        <ConfirmDialog
          title="Reset to sample data?"
          message={`This removes "${state.source?.fileName ?? "the dataset"}" and all its record corrections from the server for every user — this can't be undone.`}
          confirmLabel="Reset"
          onCancel={() => setShowResetConfirm(false)}
          onConfirm={() => {
            setShowResetConfirm(false);
            setResetError(null);
            resetDataset().catch((err) => setResetError(err instanceof Error ? err.message : "Reset failed."));
          }}
        />
      )}
    </>
  );
}
