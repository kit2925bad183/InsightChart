"use client";

import { CloudOff, Check, Loader2, Eye } from "lucide-react";
import { useApp } from "@/context/AppContext";

/** Tells editors whether their changes reached the server, and tells view-only roles
 * that nothing they tweak is saved. */
export function SyncStatus() {
  const { state, canEdit, retrySave } = useApp();

  if (!canEdit) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)]" title="Your role can view and download, but not change records.">
        <Eye size={12} /> View only
      </span>
    );
  }
  if (state.sync === "saving") {
    return (
      <span role="status" className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
        <Loader2 size={12} className="animate-spin" /> Saving…
      </span>
    );
  }
  if (state.sync === "error") {
    return (
      <button
        type="button"
        role="alert"
        onClick={retrySave}
        className="inline-flex items-center gap-1 rounded-full bg-[var(--status-critical-soft)] px-2 py-1 text-[11px] font-medium text-[var(--status-critical)] hover:underline"
        title={`${state.syncError ?? "Save failed."} Click to try again.`}
      >
        <CloudOff size={12} /> Not saved — retry
      </button>
    );
  }
  if (state.sync === "saved") {
    return (
      <span role="status" className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
        <Check size={12} /> Saved
      </span>
    );
  }
  return null;
}
