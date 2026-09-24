"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="card max-w-md w-full p-8 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-[var(--status-critical-soft)] text-[var(--status-critical)] flex items-center justify-center">
          <AlertTriangle size={22} />
        </div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Something went wrong</h1>
        <p className="text-sm text-[var(--text-muted)] mt-2">
          InsightChart hit an unexpected error while rendering the dashboard. Your data never left your browser — try again, or reset to sample data.
        </p>
        <button
          onClick={reset}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium px-4 py-2 hover:bg-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <RotateCcw size={14} /> Try again
        </button>
      </div>
    </div>
  );
}
