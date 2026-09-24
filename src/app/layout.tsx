import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InsightChart — Automated Assessment Analytics",
  description: "Upload student assessment data and get instant score-distribution dashboards, department comparisons, and reports.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
