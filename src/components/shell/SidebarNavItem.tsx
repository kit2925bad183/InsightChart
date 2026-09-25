"use client";

import Link from "next/link";
import type { KeyboardEvent } from "react";
import { clsx } from "clsx";
import { Badge } from "@/components/ui/Select";
import type { NavItem } from "@/lib/nav";

export function SidebarNavItem({
  item,
  active,
  collapsed,
  badgeCount,
  tabIndex,
  onKeyDown,
  itemRef,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  badgeCount?: number;
  tabIndex: number;
  onKeyDown: (e: KeyboardEvent<HTMLAnchorElement>) => void;
  itemRef: (el: HTMLAnchorElement | null) => void;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      ref={itemRef}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={clsx(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors border-l-[3px] pl-[9px]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent-strong)] border-[var(--accent)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] border-transparent"
      )}
    >
      <Icon size={18} className="shrink-0" />
      <span className="sidebar-label truncate flex-1">{item.label}</span>
      {!!badgeCount && (
        <span className="sidebar-label shrink-0">
          <Badge tone={item.badgeSource === "alerts" ? "critical" : "accent"}>{badgeCount}</Badge>
        </span>
      )}
    </Link>
  );
}
