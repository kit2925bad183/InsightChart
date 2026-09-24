"use client";

import { useMemo, useState } from "react";
import { Search, RotateCcw } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { canonicalDepartmentLabel } from "@/lib/analysis/normalizeDepartment";

/** Lets a user correct the department-grouping heuristic for any raw value it guessed
 * wrong — e.g. a college-specific abbreviation the regex rules don't recognize. */
export function DepartmentOverridesPanel() {
  const { state, dispatch, activeSheet } = useApp();
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const deptKey = state.mapping.department;
    if (!activeSheet || !deptKey) return [];
    const counts = new Map<string, number>();
    for (const row of activeSheet.rows) {
      const raw = String(row[deptKey] ?? "").trim();
      if (!raw) continue;
      counts.set(raw, (counts.get(raw) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([raw, count]) => ({
        raw,
        count,
        auto: canonicalDepartmentLabel(raw),
        override: state.departmentOverrides[raw],
      }))
      .sort((a, b) => b.count - a.count);
  }, [activeSheet, state.mapping.department, state.departmentOverrides]);

  const filtered = search.trim() ? rows.filter((r) => r.raw.toLowerCase().includes(search.trim().toLowerCase())) : rows;

  if (!state.mapping.department) {
    return <p className="text-sm text-[var(--text-muted)]">Map a department / group column first.</p>;
  }

  return (
    <div>
      <div className="relative mb-2">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter raw values…"
          aria-label="Filter raw department values"
          className="w-full text-xs rounded-lg border border-[var(--border-strong)] bg-white pl-7 pr-2.5 py-1.5"
        />
      </div>
      <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[var(--surface-muted,#f2f6fc)]">
            <tr className="text-left">
              <th className="px-2.5 py-1.5 font-semibold text-[var(--text-secondary)]">Raw value</th>
              <th className="px-2.5 py-1.5 font-semibold text-[var(--text-secondary)]">Count</th>
              <th className="px-2.5 py-1.5 font-semibold text-[var(--text-secondary)]">Grouped as</th>
              <th className="px-2.5 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.raw} className="border-t border-[var(--border)]">
                <td className="px-2.5 py-1.5 max-w-[160px] truncate" title={r.raw}>
                  {r.raw}
                </td>
                <td className="px-2.5 py-1.5 tabular text-[var(--text-muted)]">{r.count}</td>
                <td className="px-2.5 py-1.5">
                  <input
                    value={r.override ?? r.auto}
                    onChange={(e) => dispatch({ type: "SET_DEPARTMENT_OVERRIDE", raw: r.raw, code: e.target.value || null })}
                    aria-label={`Department code for "${r.raw}"`}
                    className={`w-20 rounded border px-1.5 py-1 ${r.override ? "border-[var(--accent)] font-semibold" : "border-[var(--border)]"}`}
                  />
                </td>
                <td className="px-2.5 py-1.5">
                  {r.override && (
                    <button
                      onClick={() => dispatch({ type: "SET_DEPARTMENT_OVERRIDE", raw: r.raw, code: null })}
                      aria-label={`Reset "${r.raw}" to auto-detected grouping`}
                      className="text-[var(--text-muted)] hover:text-[var(--accent)]"
                      title="Reset to auto"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={4} className="px-2.5 py-4 text-center text-[var(--text-muted)]">
                  No matching values.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[var(--text-muted)] mt-1.5">Edit a code to override how that raw value is grouped. {rows.length} distinct value{rows.length === 1 ? "" : "s"} found.</p>
    </div>
  );
}
