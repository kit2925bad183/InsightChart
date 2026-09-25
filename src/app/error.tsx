"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { reportError } from "@/lib/telemetry";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error, { source: "error-boundary", digest: error.digest });
  }, [error]);

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="card max-w-md w-full p-8 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-[var(--status-critical-soft)] text-[var(--status-critical)] flex items-center justify-center">
          <AlertTriangle size={22} />
        </div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Something went wrong</h1>
        <p className="text-sm text-[var(--text-muted)] mt-2">
          InsightChart hit an unexpected error while showing this page. Your saved data is safe on the server — try again, or reload the page.
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
