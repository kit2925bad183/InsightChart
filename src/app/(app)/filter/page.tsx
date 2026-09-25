"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Download, FilterX, Search, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useSession } from "@/lib/auth/session";
import { UploadArea } from "@/components/upload/UploadArea";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { exportRowsCsv } from "@/lib/export";
import { fmt, mean, round1 } from "@/lib/analysis/stats";
import {
  applyFilters,
  buildFilterFields,
  cellText,
  choiceCounts,
  compareRegister,
  describeFilter,
  emptyFilter,
  isActive,
  type FieldFilter,
  type FilterField,
  type FilterOptions,
  type Filters,
} from "@/lib/analysis/rowFilters";
import type { DataSheet } from "@/lib/types";

const PAGE_SIZE = 25;
const inputClass =
  "w-full min-w-0 text-sm rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1.5 text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]";

// ─── One filter control per column ──────────────────────────────────────────

function ChoiceControl({ options, value, onChange, label }: { options: { value: string; count: number }[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  const [find, setFind] = useState("");
  const shown = find.trim() ? options.filter((o) => o.value.toLowerCase().includes(find.trim().toLowerCase())) : options;
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="space-y-2">
      {options.length > 8 && <input value={find} onChange={(e) => setFind(e.target.value)} placeholder={`Find ${label.toLowerCase()}…`} aria-label={`Find ${label}`} className={inputClass} />}
      <div className="max-h-52 overflow-y-auto space-y-0.5 pr-1">
        {shown.map((o) => (
          <label key={o.value} className={`flex items-center gap-2 rounded px-1.5 py-1 text-sm cursor-pointer hover:bg-[var(--accent-soft)] ${o.count === 0 && !value.includes(o.value) ? "opacity-50" : ""}`}>
            <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} className="accent-[var(--accent)]" />
            <span className="flex-1 min-w-0 truncate text-[var(--text-primary)]" title={o.value}>
              {o.value}
            </span>
            <span className="text-[11px] tabular text-[var(--text-muted)]">{o.count}</span>
          </label>
        ))}
        {!shown.length && <p className="text-xs text-[var(--text-muted)] px-1.5 py-1">No match.</p>}
      </div>
      {value.length > 0 && (
        <button type="button" onClick={() => onChange([])} className="text-xs text-[var(--accent-strong)] hover:underline">
          Clear selection
        </button>
      )}
    </div>
  );
}

function FieldControl({ field, filter, onChange, options }: { field: FilterField; filter: FieldFilter; onChange: (f: FieldFilter) => void; options: { value: string; count: number }[] }) {
  switch (filter.kind) {
    case "choice":
      return <ChoiceControl label={field.label} options={options} value={filter.values} onChange={(values) => onChange({ ...filter, values })} />;
    case "text":
      return (
        <div className="space-y-2">
          <input
            value={filter.contains}
            onChange={(e) => onChange({ ...filter, contains: e.target.value })}
            placeholder="Contains…"
            aria-label={`${field.label} contains`}
            className={inputClass}
          />
          {field.range && (
            <div className="grid grid-cols-2 gap-2">
              <input value={filter.from} onChange={(e) => onChange({ ...filter, from: e.target.value })} placeholder="From (e.g. 21CS001)" aria-label={`${field.label} from`} className={inputClass} />
              <input value={filter.to} onChange={(e) => onChange({ ...filter, to: e.target.value })} placeholder="To (e.g. 21CS060)" aria-label={`${field.label} to`} className={inputClass} />
            </div>
          )}
        </div>
      );
    case "number":
      return (
        <div className="grid grid-cols-2 gap-2">
          <input type="number" value={filter.min} onChange={(e) => onChange({ ...filter, min: e.target.value })} placeholder={`Min ${field.min ?? ""}`} aria-label={`${field.label} minimum`} className={inputClass} />
          <input type="number" value={filter.max} onChange={(e) => onChange({ ...filter, max: e.target.value })} placeholder={`Max ${field.max ?? ""}`} aria-label={`${field.label} maximum`} className={inputClass} />
        </div>
      );
    case "date":
      return (
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={filter.from} min={field.min as string} max={field.max as string} onChange={(e) => onChange({ ...filter, from: e.target.value })} aria-label={`${field.label} from`} className={inputClass} />
          <input type="date" value={filter.to} min={field.min as string} max={field.max as string} onChange={(e) => onChange({ ...filter, to: e.target.value })} aria-label={`${field.label} to`} className={inputClass} />
        </div>
      );
  }
}

const KIND_HINT: Record<FilterField["kind"], string> = { choice: "Pick values", text: "Search", number: "Range", date: "Date range" };

// ─── The page ───────────────────────────────────────────────────────────────

function DataFilter({ sheet, fileName }: { sheet: DataSheet; fileName: string }) {
  const { state } = useApp();
  const { can } = useSession();
  const fields = useMemo(() => buildFilterFields(sheet, state.columns, state.mapping), [sheet, state.columns, state.mapping]);
  const opts: FilterOptions = useMemo(
    () => ({ departmentKey: state.mapping.department, normalizeDepartments: state.normalizeDepartments, departmentOverrides: state.departmentOverrides }),
    [state.mapping.department, state.normalizeDepartments, state.departmentOverrides]
  );
  const [filters, setFilters] = useState<Filters>({});
  const [search, setSearch] = useState("");
  // The identity columns and first grouping start open; the rest are one click away.
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(fields.slice(0, 3).map((f) => [f.key, true])));
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);

  const filterOf = (f: FilterField) => filters[f.key] ?? emptyFilter(f);
  const setFilter = (key: string, f: FieldFilter) => {
    setFilters((prev) => ({ ...prev, [key]: f }));
    setPage(0);
  };
  const clearAll = () => {
    setFilters({});
    setSearch("");
    setPage(0);
  };

  const rows = useMemo(() => applyFilters(sheet, filters, search, opts), [sheet, filters, search, opts]);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const field = fields.find((f) => f.key === sort.key);
    const cmp = (a: DataSheet["rows"][number], b: DataSheet["rows"][number]) => {
      if (field?.kind === "number") return (Number(a[sort.key]) || 0) - (Number(b[sort.key]) || 0);
      if (field?.range) return compareRegister(cellText(a, sort.key, opts), cellText(b, sort.key, opts));
      return cellText(a, sort.key, opts).localeCompare(cellText(b, sort.key, opts), "en", { numeric: true });
    };
    const out = [...rows].sort(cmp);
    return sort.dir === "asc" ? out : out.reverse();
  }, [rows, sort, fields, opts]);

  const activeFields = fields.filter((f) => isActive(filters[f.key]));
  const scoreKey = state.mapping.numeric;
  const scores = scoreKey ? rows.map((r) => Number(r[scoreKey])).filter(Number.isFinite) : [];
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const download = () =>
    exportRowsCsv(
      sorted.map((r) => Object.fromEntries(sheet.headers.map((h) => [h, r[h] ?? ""]))),
      `${fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-") || "insightchart"}-filtered`
    );

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] items-start">
      {/* Filters */}
      <Card className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <CardHeader
          title="Filters"
          subtitle={`${fields.length} from ${fileName}`}
          actions={
            activeFields.length || search ? (
              <Button size="sm" variant="ghost" onClick={clearAll}>
                <FilterX size={13} /> Clear all
              </Button>
            ) : undefined
          }
        />
        <div className="relative mb-3">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search every column…"
            aria-label="Search every column"
            className={`${inputClass} pl-7`}
          />
        </div>
        <div className="divide-y divide-[var(--border)] -mx-1">
          {fields.map((f) => {
            const active = isActive(filters[f.key]);
            const expanded = open[f.key] || active;
            return (
              <section key={f.key} className="px-1 py-2" data-testid={`filter-${f.key}`}>
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [f.key]: !expanded }))}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-2 text-left text-sm font-medium text-[var(--text-primary)]"
                >
                  <span className="flex-1 min-w-0 truncate" title={f.label}>
                    {f.label}
                  </span>
                  {active ? (
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-label="active" />
                  ) : (
                    <span className="text-[11px] font-normal text-[var(--text-muted)]">{f.range ? "Search or range" : KIND_HINT[f.kind]}</span>
                  )}
                  <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
                {expanded && (
                  <div className="mt-2">
                    <FieldControl field={f} filter={filterOf(f)} onChange={(nf) => setFilter(f.key, nf)} options={f.kind === "choice" ? choiceCounts(sheet, f, filters, search, opts) : []} />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </Card>

      {/* Results */}
      <div className="space-y-4 min-w-0">
        <Card>
          <CardHeader
            title="Matching records"
            subtitle={`${rows.length} of ${sheet.rows.length} rows`}
            actions={
              can("reports:download") ? (
                <Button size="sm" variant="outline" onClick={download} disabled={!rows.length}>
                  <Download size={13} /> CSV
                </Button>
              ) : undefined
            }
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3" data-testid="filter-summary">
            <Stat label="Rows" value={rows.length} hint={`${Math.round((rows.length / Math.max(1, sheet.rows.length)) * 100)}% of the file`} />
            {scores.length > 0 && (
              <>
                <Stat label={`Average ${scoreKey}`} value={round1(mean(scores))} />
                <Stat label="Highest" value={Math.max(...scores)} />
                <Stat label="Lowest" value={Math.min(...scores)} />
              </>
            )}
          </div>
          {(activeFields.length > 0 || search.trim()) && (
            <div className="flex flex-wrap gap-1.5 mb-3" aria-label="Active filters">
              {search.trim() && <Chip label={`Search: “${search.trim()}”`} onRemove={() => setSearch("")} />}
              {activeFields.map((f) => (
                <Chip key={f.key} label={describeFilter(f, filters[f.key])} onRemove={() => setFilter(f.key, emptyFilter(f))} />
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-xs" aria-label="Filtered records">
              <thead>
                <tr className="bg-[var(--surface-muted)] text-left">
                  {sheet.headers.map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold text-[var(--text-secondary)] whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSort((s) => (s?.key === h ? (s.dir === "asc" ? { key: h, dir: "desc" } : null) : { key: h, dir: "asc" }))}
                        className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]"
                        aria-label={`Sort by ${h}`}
                      >
                        {h}
                        {sort?.key === h && (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={page * PAGE_SIZE + i} className="border-t border-[var(--border)]">
                    {sheet.headers.map((h) => (
                      <td key={h} className="px-3 py-2 text-[var(--text-primary)] whitespace-nowrap max-w-72 truncate" title={fmt(r[h] ?? null)}>
                        {h === opts.departmentKey ? cellText(r, h, opts) : fmt(r[h] ?? null)}
                      </td>
                    ))}
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={sheet.headers.length} className="px-3 py-8 text-center text-[var(--text-muted)]">
                      No records match these filters.{" "}
                      <button type="button" onClick={clearAll} className="text-[var(--accent-strong)] underline">
                        Clear all filters
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between mt-3 text-xs text-[var(--text-muted)]">
              <span>
                Rows {page * PAGE_SIZE + 1}–{Math.min(sorted.length, (page + 1) * PAGE_SIZE)} of {sorted.length}
              </span>
              <span className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] px-3 py-2 min-w-0">
      <p className="text-[11px] text-[var(--text-muted)] truncate" title={label}>
        {label}
      </p>
      <p className="text-lg font-semibold text-[var(--text-primary)] tabular leading-tight">{value}</p>
      {hint && <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] pl-2.5 pr-1 py-0.5 text-xs text-[var(--accent-strong)]">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove filter ${label}`} className="rounded-full p-0.5 hover:bg-[var(--surface)]">
        <X size={11} />
      </button>
    </span>
  );
}

export default function DataFilterPage() {
  const { state, activeSheet } = useApp();
  if (!activeSheet) return <UploadArea />;
  const fileName = state.source?.kind === "mock" ? "sample data" : (state.source?.fileName ?? "the uploaded file");
  // A new upload starts with fresh filters built from its own columns.
  return <DataFilter key={`${activeSheet.id}:${state.loadNonce}`} sheet={activeSheet} fileName={fileName} />;
}
