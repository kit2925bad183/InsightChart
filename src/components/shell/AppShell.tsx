"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MobileSidebarDrawer } from "./MobileSidebarDrawer";
import { Topbar } from "./Topbar";
import { useSidebarCollapsed } from "@/lib/uiPrefs";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/Button";
import { Info, X } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { state, dispatch, reloadDataset } = useApp();
  const pathname = usePathname();
  // Account/admin pages don't read the dataset, so they never wait on it.
  const needsDataset = !["/account", "/admin", "/forbidden"].some((p) => pathname === p || pathname.startsWith(p + "/"));

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
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
          {state.notice && (
            <div role="status" className="rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2.5 text-xs text-[var(--text-primary)] flex gap-2 items-start fade-in">
              <Info size={15} className="shrink-0 mt-0.5 text-[var(--accent)]" />
              <p className="flex-1">{state.notice}</p>
              <button onClick={() => dispatch({ type: "DISMISS_NOTICE" })} aria-label="Dismiss notice" className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X size={14} />
              </button>
            </div>
          )}
          {!needsDataset ? (
            children
          ) : !state.bootstrapped ? (
            <div className="card p-10 text-center text-sm text-[var(--text-secondary)] fade-in" role="status">
              Loading the shared dataset…
            </div>
          ) : !state.source && state.status === "error" ? (
            <div className="card p-8 text-center fade-in" role="alert">
              <p className="text-sm font-semibold text-[var(--status-critical)]">{state.errorMessage ?? "Couldn't load the shared dataset."}</p>
              <Button className="mt-3" variant="outline" onClick={() => reloadDataset().catch(() => {})}>
                Try again
              </Button>
            </div>
          ) : (
            children
          )}
        </main>
        <footer className="border-t border-[var(--border)] py-4">
          <p className="text-center text-[11px] text-[var(--text-muted)]">
            Data is stored on this InsightChart server and is visible only to signed-in staff.
          </p>
        </footer>
      </div>
    </div>
  );
}
