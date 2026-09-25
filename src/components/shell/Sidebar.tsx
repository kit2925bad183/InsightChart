"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, BarChart3 } from "lucide-react";
import { isNavItemActive, navItemsFor } from "@/lib/nav";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarSearch } from "./SidebarSearch";
import { SidebarProfile } from "./SidebarProfile";
import { useRovingIndex } from "./useRovingIndex";
import { useSession } from "@/lib/auth/session";
import { useNotificationCounts } from "@/lib/notifications";

export function Sidebar({ collapsed, onToggleCollapsed }: { collapsed: boolean; onToggleCollapsed: () => void }) {
  const pathname = usePathname();
  const { user } = useSession();
  const { alertsCount, tasksDueCount } = useNotificationCounts();
  const visibleItems = navItemsFor(user.role);
  const { activeIndex, registerRef, onKeyDown } = useRovingIndex(visibleItems.length);

  const badgeFor = (source?: "tasks" | "alerts") => (source === "tasks" ? tasksDueCount : source === "alerts" ? alertsCount : 0);

  return (
    <aside
      className="hidden md:flex flex-col fixed inset-y-0 left-0 z-20 border-r border-[var(--border)] bg-[var(--surface)]"
      style={{ width: "var(--sidebar-current-width)" }}
    >
      <div className="flex items-center gap-2 px-4 h-[var(--topbar-height)] border-b border-[var(--border)] shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
          <span className="rounded-lg bg-[var(--accent)] text-white p-1.5 shrink-0">
            <BarChart3 size={18} />
          </span>
          <span className="sidebar-label text-sm font-bold text-[var(--text-primary)] leading-none truncate">InsightChart</span>
        </Link>
      </div>

      <div className="px-3 pt-3">
        <SidebarSearch collapsed={collapsed} onExpandRequest={onToggleCollapsed} />
      </div>

      <nav aria-label="Main navigation" className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-0.5">
        {visibleItems.map((item, i) => (
          <SidebarNavItem
            key={item.href}
            item={item}
            collapsed={collapsed}
            active={isNavItemActive(item, pathname)}
            badgeCount={badgeFor(item.badgeSource)}
            tabIndex={i === activeIndex ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, i)}
            itemRef={registerRef(i)}
          />
        ))}
      </nav>

      <div className="px-3 pb-1">
        <button
          type="button"
          onClick={() => onToggleCollapsed()}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex items-center justify-center w-full rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>

      <div className="px-3 pb-3">
        <SidebarProfile collapsed={collapsed} onExpandRequest={() => onToggleCollapsed()} />
      </div>
    </aside>
  );
}
