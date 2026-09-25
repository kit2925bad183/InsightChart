"use client";

import { useEffect, useState } from "react";
import type { Role } from "./roles";

const SIDEBAR_KEY = "insightchart-sidebar-collapsed";
const ROLE_KEY = "insightchart-acting-role";
const ROLE_CHANGE_EVENT = "insightchart:role-change";

function applySidebarAttr(collapsed: boolean) {
  document.documentElement.setAttribute("data-sidebar", collapsed ? "collapsed" : "expanded");
}

/** Mirrors ThemeToggle's pattern: starts at the server-safe default and syncs the real
 * stored preference post-mount (the pre-hydration script in layout.tsx already applied
 * the right `data-sidebar` attribute pre-paint, so layout width never flashes even
 * though this React state itself settles a tick later). */
export function useSidebarCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsedState(localStorage.getItem(SIDEBAR_KEY) === "1");
  }, []);

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try {
      localStorage.setItem(SIDEBAR_KEY, v ? "1" : "0");
    } catch {}
    applySidebarAttr(v);
  };

  return [collapsed, setCollapsed];
}

/** Client-side-only "acting as" role — see roles.ts. Defaults to administrator (sees
 * everything) so the app isn't confusingly locked down before anyone has chosen a role.
 *
 * Multiple independent components call this hook (Sidebar, SidebarProfile,
 * MobileSidebarDrawer, the Settings page) in unrelated parts of the tree — a plain
 * localStorage-backed useState per instance would go stale the moment one of them
 * changes the role, since localStorage writes don't trigger re-renders anywhere and
 * the native `storage` event only fires in *other* tabs, never the one that wrote it.
 * Broadcasting a custom window event on every change (the same pattern this app
 * already uses for "insightchart:focus-search"/"insightchart:trigger-upload") keeps
 * every instance in sync without introducing a React Context. */
export function useActingAsRole(): [Role, (r: Role) => void] {
  const [role, setRoleState] = useState<Role>("administrator");

  useEffect(() => {
    const stored = localStorage.getItem(ROLE_KEY) as Role | null;
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoleState(stored);
    }
    const onChange = (e: Event) => setRoleState((e as CustomEvent<Role>).detail);
    window.addEventListener(ROLE_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(ROLE_CHANGE_EVENT, onChange);
  }, []);

  const setRole = (r: Role) => {
    setRoleState(r);
    try {
      localStorage.setItem(ROLE_KEY, r);
    } catch {}
    window.dispatchEvent(new CustomEvent(ROLE_CHANGE_EVENT, { detail: r }));
  };

  return [role, setRole];
}
