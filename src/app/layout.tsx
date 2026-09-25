import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ErrorListener } from "@/components/ErrorListener";
import { AppProvider } from "@/context/AppContext";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://insightchart.app"),
  title: "InsightChart — Automated Assessment Analytics",
  description: "Upload student assessment data and get instant score-distribution dashboards, department comparisons, and reports.",
  openGraph: {
    title: "InsightChart — Automated Assessment Analytics",
    description: "Upload student assessment data and get instant score-distribution dashboards, department comparisons, and reports.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "InsightChart — Automated Assessment Analytics",
    description: "Upload student assessment data and get instant score-distribution dashboards, department comparisons, and reports.",
  },
  robots: { index: true, follow: true },
};

// Runs before paint, as the first thing in <body>, so the stored theme preference
// applies immediately — otherwise the page would flash light before JS hydrates and
// corrects it. Static string, no user data interpolated.
const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem("insightchart-theme");
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
`;

// Same pre-hydration precedent as THEME_INIT_SCRIPT — sets the sidebar's collapsed/
// expanded attribute before paint so the sidebar width never flashes on load.
const SIDEBAR_INIT_SCRIPT = `
try {
  var c = localStorage.getItem("insightchart-sidebar-collapsed");
  document.documentElement.setAttribute("data-sidebar", c === "1" ? "collapsed" : "expanded");
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Script id="sidebar-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: SIDEBAR_INIT_SCRIPT }} />
        <ErrorListener />
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
