"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Bell } from "lucide-react";
import { isNavItemActive, navItemsFor } from "@/lib/nav";
import { useSession } from "@/lib/auth/session";
import { SyncStatus } from "./SyncStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UploadArea } from "@/components/upload/UploadArea";
import { useNotificationCounts } from "@/lib/notifications";
import { Badge } from "@/components/ui/Select";
import Link from "next/link";

const EXTRA_TITLES: Record<string, string> = { "/settings": "Settings", "/account": "My Account", "/forbidden": "Access denied" };

export function Topbar({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const pathname = usePathname();
  const { alertsCount, tasksDueCount, total } = useNotificationCounts();
  const [bellOpen, setBellOpen] = useState(false);

  const { user } = useSession();
  const currentTitle = navItemsFor(user.role).find((i) => isNavItemActive(i, pathname))?.label ?? EXTRA_TITLES[pathname] ?? "InsightChart";

  return (
    <header
      className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur"
      style={{ height: "var(--topbar-height)" }}
    >
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="md:hidden rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--accent-soft)]"
          >
            <Menu size={18} />
          </button>
          <h1 className="text-sm font-semibold text-[var(--text-primary)] truncate">{currentTitle}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <button
              onClick={() => setBellOpen((v) => !v)}
              aria-label={`Notifications${total ? `, ${total} pending` : ""}`}
              aria-expanded={bellOpen}
              className="relative rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            >
              <Bell size={16} />
              {total > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-[var(--status-critical)] text-white text-[9px] font-bold flex items-center justify-center">
                  {total > 9 ? "9+" : total}
                </span>
              )}
            </button>
            {bellOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg p-3 z-30 fade-in"
                onMouseLeave={() => setBellOpen(false)}
              >
                <p className="text-xs font-semibold text-[var(--text-primary)] mb-2">Notifications</p>
                <Link href="/alerts" onClick={() => setBellOpen(false)} className="flex items-center justify-between text-xs py-1.5 hover:text-[var(--accent-strong)]">
                  <span>Open alerts</span>
                  {alertsCount > 0 && <Badge tone="critical">{alertsCount}</Badge>}
                </Link>
                <Link href="/tasks" onClick={() => setBellOpen(false)} className="flex items-center justify-between text-xs py-1.5 hover:text-[var(--accent-strong)]">
                  <span>Tasks due</span>
                  {tasksDueCount > 0 && <Badge tone="accent">{tasksDueCount}</Badge>}
                </Link>
                {total === 0 && <p className="text-[11px] text-[var(--text-muted)] mt-1">Nothing pending.</p>}
              </div>
            )}
          </div>
          <SyncStatus />
          <ThemeToggle />
          <UploadArea compact />
        </div>
      </div>
    </header>
  );
}
