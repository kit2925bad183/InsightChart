import type { NextConfig } from "next";
import path from "path";

const isDev = process.env.NODE_ENV !== "production";

// InsightChart now has signed-in sessions (an httpOnly session cookie) and a server-side
// dataset, so this CSP guards against script injection (e.g. from a malicious uploaded
// file's contents) reaching an authenticated page. 'unsafe-inline' on script/style is required
// by Next.js's inline hydration payload and by our extensive use of inline `style={}}`
// for dynamic chart colors — tightening further would need a nonce-based middleware.
// 'unsafe-eval' is added in dev only: React's dev-mode uses eval() to reconstruct
// stack traces (never in production builds), so gating it keeps production maximally strict.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://va.vercel-scripts.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // The embedded Postgres ships a WebAssembly build and data files it loads from its own
  // package folder at runtime, so it must be required from node_modules, not bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must never be served from a cache, or app updates would stall.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
