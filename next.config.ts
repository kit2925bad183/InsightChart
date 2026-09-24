import type { NextConfig } from "next";
import path from "path";

const isDev = process.env.NODE_ENV !== "production";

// InsightChart is fully client-side (no backend, no user auth, no cookies of value),
// so this CSP is mainly a defense-in-depth measure against a compromised/malicious
// uploaded-file-triggered script injection. 'unsafe-inline' on script/style is required
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
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
