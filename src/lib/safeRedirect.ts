/**
 * Where to go after signing in, from an untrusted `?next=` value. Only a path on this same
 * site is accepted; anything that would leave it — "//evil.com", "/\evil.com", "https://…",
 * or tricks with tabs/newlines that browsers strip ("/\t/evil.com" becomes "//evil.com") —
 * falls back to the dashboard. Otherwise a link to the sign-in page could hand someone off
 * to a look-alike site straight after they sign in.
 */
export function safeRedirect(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/")) return fallback;
  const base = "https://insightchart.invalid";
  try {
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    const path = url.pathname + url.search + url.hash;
    // Paths into the sign-in flow itself would loop.
    if (/^\/(login|welcome|first-login|forgot-password)(\/|$|\?)/.test(path)) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
