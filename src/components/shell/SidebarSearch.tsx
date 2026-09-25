"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { navItemsFor } from "@/lib/nav";
import { useSession } from "@/lib/auth/session";

/** Navigation search, not a data search — filters the pages this role can open by label. Data/student
 * search lives on the Student Explorer page. */
export function SidebarSearch({ collapsed, onExpandRequest }: { collapsed: boolean; onExpandRequest?: () => void }) {
  const router = useRouter();
  const { role } = useSession().user;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return navItemsFor(role).filter((i) => i.label.toLowerCase().includes(q));
  }, [query, role]);

  const go = (href: string) => {
    router.push(href);
    setQuery("");
    setOpen(false);
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => {
          onExpandRequest?.();
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        aria-label="Search pages"
        className="flex items-center justify-center rounded-lg p-2.5 text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
      >
        <Search size={18} />
      </button>
    );
  }

  return (
    <div className="relative sidebar-label">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (matches[activeIndex]) go(matches[activeIndex].href);
          } else if (e.key === "Escape") {
            setQuery("");
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        placeholder="Search pages…"
        aria-label="Search sidebar pages"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        className="w-full text-xs rounded-lg border border-[var(--border-strong)] bg-white pl-7 pr-2.5 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
      />
      {open && query.trim() && (
        <ul id={listId} role="listbox" className="absolute z-30 top-full mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-[var(--border)] bg-white shadow-lg py-1 text-sm">
          {matches.length === 0 && <li className="px-3 py-1.5 text-[var(--text-muted)] text-xs">No matching pages</li>}
          {matches.map((m, i) => {
            const Icon = m.icon;
            return (
              <li
                key={m.href}
                role="option"
                aria-selected={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(m.href);
                }}
                className={`px-3 py-1.5 cursor-pointer text-xs flex items-center gap-2 ${i === activeIndex ? "bg-[var(--accent-soft)]" : ""}`}
              >
                <Icon size={13} className="text-[var(--text-muted)]" />
                {m.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
