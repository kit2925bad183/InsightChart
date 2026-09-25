/**
 * The site's public address, for links in emails and page metadata. Taken from
 * configuration, never from the incoming request's Host header (which the sender controls):
 * APP_URL if set, else the production domain Vercel provides, else null.
 */
export function configuredSiteUrl(env: Record<string, string | undefined> = process.env): string | null {
  const app = env.APP_URL?.trim().replace(/\/+$/, "");
  if (app) return app;
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return null;
}
