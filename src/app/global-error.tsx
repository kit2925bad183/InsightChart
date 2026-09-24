"use client";

import { useEffect } from "react";

// Next.js only invokes this for errors thrown by the ROOT layout itself (rare —
// most crashes are caught by app/error.tsx instead). It must render its own
// <html>/<body> since it fully replaces the root layout when triggered.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", background: "#eef3fb" }}>
        <div style={{ textAlign: "center", padding: 32 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#0b1f3a" }}>InsightChart failed to load</h1>
          <p style={{ fontSize: 14, color: "#7186a3", marginTop: 8 }}>Please try reloading the page.</p>
          <button
            onClick={reset}
            style={{ marginTop: 16, background: "#2a78d6", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
