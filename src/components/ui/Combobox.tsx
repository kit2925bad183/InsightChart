"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { clsx } from "clsx";

export interface ComboboxOption {
  value: string;
  label: string;
}

export function Combobox({
  label,
  value,
  onChange,
  options,
  placeholder = "None",
  allowClear = true,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  options: ComboboxOption[];
  placeholder?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const openList = () => {
    setOpen(true);
    setActiveIndex(0);
  };

  const commit = (v: string | undefined) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  const inputId = `${listId}-input`;

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1 min-w-0 text-xs font-medium text-[var(--text-secondary)]">
      <label htmlFor={inputId}>{label}</label>
      <div
        className={clsx(
          "flex items-center gap-1 rounded-lg border bg-white pl-2.5 pr-1.5 py-1.5 cursor-text",
          open ? "border-[var(--accent)] ring-2 ring-[var(--accent-soft)]" : "border-[var(--border-strong)]"
        )}
        onClick={() => {
          openList();
          inputRef.current?.focus();
        }}
      >
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="min-w-0 flex-1 text-sm text-[var(--text-primary)] outline-none bg-transparent truncate"
          placeholder={placeholder}
          title={selected?.label}
          value={open ? query : (selected?.label ?? "")}
          onFocus={openList}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) openList();
              else setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (filtered[activeIndex]) commit(filtered[activeIndex].value);
            } else if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
              inputRef.current?.blur();
            }
          }}
        />
        {allowClear && value && !open && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              commit(undefined);
            }}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"
          >
            <X size={13} />
          </button>
        )}
        <ChevronDown size={13} className="text-[var(--text-muted)] shrink-0" />
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 top-full mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-[var(--border)] bg-white shadow-lg py-1 text-sm"
        >
          {filtered.length === 0 && <li className="px-3 py-1.5 text-[var(--text-muted)]">No matching columns</li>}
          {filtered.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(o.value);
              }}
              title={o.label}
              className={clsx(
                "px-3 py-1.5 cursor-pointer truncate",
                i === activeIndex && "bg-[var(--accent-soft)]",
                o.value === value && "font-semibold text-[var(--accent-strong)]"
              )}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
