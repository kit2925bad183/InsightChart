"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/telemetry";

/** Catches errors React's error boundaries can't (event handlers, async code, promise
 * rejections) so they at least get logged consistently instead of vanishing silently. */
export function ErrorListener() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportError(e.error ?? e.message, { source: "window.onerror" });
    const onRejection = (e: PromiseRejectionEvent) => reportError(e.reason, { source: "unhandledrejection" });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
