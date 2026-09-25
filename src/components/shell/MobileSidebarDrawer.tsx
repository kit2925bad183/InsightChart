"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, BarChart3, LogOut } from "lucide-react";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { signOut } from "./SidebarProfile";
import { isNavItemActive, navItemsFor } from "@/lib/nav";
import { useSession } from "@/lib/auth/session";
import { useNotificationCounts } from "@/lib/notifications";
import { Badge } from "@/components/ui/Select";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Edge-anchored slide-out panel adapting Modal.tsx's exact focus-trap logic (capture
 * previously-focused element, trap Tab/Shift+Tab, Escape closes, restore focus on
 * close) instead of Modal's centered overlay. Always mounted — visibility is purely
 * CSS (transform/opacity) plus the native `inert` attribute when closed, which removes
 * the panel from focus/AT reachability without any mount-timing logic. An earlier
 * version tried to unmount-after-a-delay via local state adjusted during render, which
 * broke under React's dev-mode double-render checks (the same class of dual-render
 * hazard this app hit once before with key-remounted components) — this version has
 * no such state to get out of sync. */
export function MobileSidebarDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { user } = useSession();
  const { alertsCount, tasksDueCount } = useNotificationCounts();
  const visibleItems = navItemsFor(user.role);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
      if (!focusable.length) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  const badgeFor = (source?: "tasks" | "alerts") => (source === "tasks" ? tasksDueCount : source === "alerts" ? alertsCount : 0);

  return (
    <div className={`md:hidden fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-[rgba(11,31,58,0.45)] transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        onMouseDown={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        inert={!open}
        className={`absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-[var(--surface)] border-r border-[var(--border)] flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 h-[var(--topbar-height)] border-b border-[var(--border)] shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2 min-w-0" onClick={onClose}>
            <span className="rounded-lg bg-[var(--accent)] text-white p-1.5 shrink-0">
              <BarChart3 size={18} />
            </span>
            <span className="text-sm font-bold text-[var(--text-primary)] leading-none truncate">InsightChart</span>
          </Link>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-soft)]"
          >
            <X size={18} />
          </button>
        </div>
        <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(item, pathname);
            const count = badgeFor(item.badgeSource);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium border-l-[3px] pl-[9px] ${
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent-strong)] border-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] border-transparent"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span className="truncate flex-1">{item.label}</span>
                {!!count && <Badge tone={item.badgeSource === "alerts" ? "critical" : "accent"}>{count}</Badge>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border)] px-4 py-3 text-xs">
          <p className="font-semibold text-[var(--text-primary)] truncate">{user.displayName}</p>
          <p className="text-[11px] text-[var(--text-muted)] mb-2">{ROLE_LABELS[user.role]}</p>
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <Link href="/account" onClick={onClose} className="text-[var(--accent-strong)] font-medium">
                Account
              </Link>
              <Link href="/settings" onClick={onClose} className="text-[var(--accent-strong)] font-medium">
                Settings
              </Link>
            </div>
            <button type="button" onClick={() => signOut()} className="flex items-center gap-1 text-[var(--text-muted)]">
              <LogOut size={12} /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
