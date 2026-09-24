"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { fmt } from "@/lib/analysis/stats";

const PAGE_SIZE = 12;

export function DataPreviewTable() {
  const { state, dispatch, activeSheet } = useApp();
  const [page, setPage] = useState(0);
  const [localSearch, setLocalSearch] = useState("");

  const filteredRows = useMemo(() => {
    if (!activeSheet) return [];
    let rows = activeSheet.rows;
    const q = localSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => activeSheet.headers.some((h) => String(r[h] ?? "").toLowerCase().includes(q)));
    }
    if (state.sortKey) {
      const key = state.sortKey;
      rows = [...rows].sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        const an = typeof av === "number" ? av : Number(av);
        const bn = typeof bv === "number" ? bv : Number(bv);
        let cmp: number;
        if (Number.isFinite(an) && Number.isFinite(bn)) cmp = an - bn;
        else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
        return state.sortDir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [activeSheet, localSearch, state.sortKey, state.sortDir]);

  const pageRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  if (!activeSheet) return null;

  const toggleSort = (key: string) => {
    if (state.sortKey === key) {
      dispatch({ type: "SET_SORT", key, dir: state.sortDir === "asc" ? "desc" : "asc" });
    } else {
      dispatch({ type: "SET_SORT", key, dir: "asc" });
    }
  };

  return (
    <Card>
      <CardHeader
        title="Data preview"
        subtitle={`${activeSheet.headers.length} columns · ${activeSheet.rows.length} rows`}
        actions={
          <>
            {state.source && state.source.sheets.length > 1 && (
              <Select
                aria-label="Select sheet"
                value={state.activeSheetId ?? ""}
                onChange={(e) => dispatch({ type: "SET_ACTIVE_SHEET", id: e.target.value })}
              >
                {state.source.sheets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={localSearch}
                onChange={(e) => {
                  setLocalSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Search rows…"
                aria-label="Search data rows"
                className="text-xs rounded-lg border border-[var(--border-strong)] bg-white pl-7 pr-2.5 py-1.5 w-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              />
            </div>
          </>
        }
      />
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[var(--surface-muted,#f2f6fc)] text-left">
              {activeSheet.headers.map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-semibold text-[var(--text-secondary)] whitespace-nowrap">
                  <button
                    onClick={() => toggleSort(h)}
                    className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] rounded"
                  >
                    {h}
                    <ArrowUpDown size={11} className={state.sortKey === h ? "text-[var(--accent)]" : "opacity-40"} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} className="border-t border-[var(--border)] hover:bg-[var(--accent-soft)]/40">
                {activeSheet.headers.map((h) => (
                  <td key={h} className="px-3 py-1.5 text-[var(--text-primary)] whitespace-nowrap tabular">
                    {fmt(row[h])}
                  </td>
                ))}
              </tr>
            ))}
            {!pageRows.length && (
              <tr>
                <td colSpan={activeSheet.headers.length} className="px-3 py-6 text-center text-[var(--text-muted)]">
                  No rows match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-[var(--text-muted)]">
        <span>
          Showing {pageRows.length ? page * PAGE_SIZE + 1 : 0}–{page * PAGE_SIZE + pageRows.length} of {filteredRows.length}
        </span>
        <div className="flex gap-1">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-2 py-1 rounded-md border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--accent-soft)]"
          >
            Prev
          </button>
          <span className="px-2 py-1">
            {page + 1} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-2 py-1 rounded-md border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--accent-soft)]"
          >
            Next
          </button>
        </div>
      </div>
    </Card>
  );
}
