// Minimal, dependency-free error reporting. Right now this just logs with a
// consistent shape; swap the body for a real provider (Sentry, etc.) once one is
// wired up — every call site already funnels through here so that's a one-file change.
export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error("[InsightChart]", err.message, { stack: err.stack, ...context });
}
