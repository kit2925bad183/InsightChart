"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { MobileSidebarDrawer } from "./MobileSidebarDrawer";
import { Topbar } from "./Topbar";
import { useSidebarCollapsed } from "@/lib/uiPrefs";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);

  // "/" focuses the data-preview search, "u" opens the upload picker — moved here from
  // the old single-page DashboardShell so the shortcut works from every routed page.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("insightchart:focus-search"));
      } else if (e.key === "u") {
        window.dispatchEvent(new CustomEvent("insightchart:trigger-upload"));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="min-h-full flex flex-col">
      <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} />
      <MobileSidebarDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col md:pl-[var(--sidebar-current-width)]">
        <Topbar onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">{children}</main>
        <footer className="border-t border-[var(--border)] py-4">
          <p className="text-center text-[11px] text-[var(--text-muted)]">
            InsightChart processes files locally in your browser — nothing is uploaded to a server.
          </p>
        </footer>
      </div>
    </div>
  );
}
