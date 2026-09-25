"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, AlertTriangle, Lock } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { parseFile, SUPPORTED_EXTENSIONS } from "@/lib/parsers";
import { Button } from "@/components/ui/Button";

export function UploadArea({ compact = false }: { compact?: boolean }) {
  const { state, dispatch, canEdit } = useApp();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      dispatch({ type: "LOADING" });
      try {
        const source = await parseFile(file);
        dispatch({ type: "LOAD_SOURCE", source });
      } catch (err) {
        dispatch({ type: "ERROR", message: err instanceof Error ? err.message : "Failed to read file." });
      }
    },
    [dispatch]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  useEffect(() => {
    if (!compact) return;
    const onTrigger = () => inputRef.current?.click();
    window.addEventListener("insightchart:trigger-upload", onTrigger);
    return () => window.removeEventListener("insightchart:trigger-upload", onTrigger);
  }, [compact]);

  // Uploading replaces the shared dataset, so only editors get the control. (The API
  // rejects uploads from other roles regardless of what the browser sends.)
  if (!canEdit) {
    if (compact) return null;
    return (
      <div className="card fade-in flex flex-col items-center justify-center gap-3 p-10 sm:p-16 text-center">
        <div className="rounded-full bg-[var(--surface-muted)] p-4">
          <Lock size={26} className="text-[var(--text-muted)]" />
        </div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {state.source ? "This view needs data that isn't in the current dataset" : "No dataset has been published yet"}
        </p>
        <p className="text-xs text-[var(--text-muted)] max-w-sm">
          Uploading and correcting records is done by an Administrator. You can view and download everything once it&apos;s published.
        </p>
      </div>
    );
  }

  // Until the shared dataset has arrived, an upload could race with (and be replaced by)
  // the server's copy — so the uploader only appears once loading is done.
  if (compact) {
    if (!state.bootstrapped) return null;
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept={SUPPORTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Reset so choosing the same file again (e.g. after fixing it) still loads it.
            e.target.value = "";
            if (file) handleFile(file);
          }}
        />
        <Button variant="primary" size="sm" onClick={() => inputRef.current?.click()}>
          <UploadCloud size={15} /> Upload file
        </Button>
      </>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      aria-label="Upload a data file by dragging it here or pressing Enter to browse"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onClick={() => inputRef.current?.click()}
      className={`card fade-in flex flex-col items-center justify-center gap-3 border-2 border-dashed p-10 sm:p-16 text-center cursor-pointer transition-colors ${
        dragging ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-strong)] hover:border-[var(--accent)]"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={SUPPORTED_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(e) => {
            const file = e.target.files?.[0];
            // Reset so choosing the same file again (e.g. after fixing it) still loads it.
            e.target.value = "";
            if (file) handleFile(file);
          }}
      />
      <div className="rounded-full bg-[var(--accent-soft)] p-4">
        <UploadCloud size={28} className="text-[var(--accent)]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">Drag and drop your file here, or click to browse</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">Excel (.xlsx, .xls), CSV, PDF, Word (.docx), TXT, and images with tables</p>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] mt-1">
        <FileSpreadsheet size={13} /> Files are read in your browser; the extracted table is saved to the server for signed-in staff
      </div>
    </div>
  );
}

export function InlineWarnings({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <div className="rounded-lg border border-[var(--status-warning)] bg-[var(--status-warning-soft)] px-3 py-2.5 text-xs text-[#7a4e00] flex gap-2 items-start fade-in">
      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
      <ul className="space-y-1">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
