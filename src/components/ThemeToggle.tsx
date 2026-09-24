"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme | null) {
  if (theme) document.documentElement.setAttribute("data-theme", theme);
  else document.documentElement.removeAttribute("data-theme");
}

export function ThemeToggle() {
  // Starts null (matches the server-rendered "no explicit theme" state) and reads the
  // real stored preference after mount, so this never disagrees with the anti-FOUC
  // inline script in layout.tsx (which already applied the right attribute pre-paint).
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Deliberately reading localStorage post-mount rather than in a lazy useState
    // initializer: the initializer would run during SSR/hydration where localStorage
    // isn't available, and returning a different value between server and client
    // renders would itself be a hydration mismatch. Starting from `null` (matching
    // the server) and syncing once mounted is the correct, if effect-based, fix.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(localStorage.getItem("insightchart-theme") as Theme | null);
  }, []);

  const isDark = theme === "dark" || (theme === null && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const toggle = () => {
    const next: Theme = isDark ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("insightchart-theme", next);
    applyTheme(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
