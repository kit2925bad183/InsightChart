"use client";

import { useEffect, useState } from "react";

const SIDEBAR_KEY = "insightchart-sidebar-collapsed";

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
