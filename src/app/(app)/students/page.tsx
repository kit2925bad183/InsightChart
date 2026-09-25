"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { RecordEditorModal } from "@/components/data/RecordEditorModal";
import { useApp, useRecords } from "@/context/AppContext";
import { UploadArea } from "@/components/upload/UploadArea";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { StudentDetailModal } from "@/components/dashboard/StudentModals";
import type { StudentRecord } from "@/lib/analysis/stats";
import { bandForScore } from "@/lib/analysis/scoreBands";

/** Search/filter list today; a dedicated /students/[registration] profile page with
 * rank, score history (from upload history), and staff notes lands in Phase 2 once
 * that persistent data layer exists. */
export default function StudentsPage() {
  const { state, activeSheet, canEdit } = useApp();
  const [adding, setAdding] = useState(false);
  const records = useRecords();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [tier, setTier] = useState("");
  const [selected, setSelected] = useState<StudentRecord | null>(null);

  const departments = useMemo(() => Array.from(new Set(records.map((r) => r.department))).filter((d) => d && d !== "—").sort(), [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.registration.toLowerCase().includes(q)) return false;
      if (department && r.department !== department) return false;
      if (tier) {
        const band = bandForScore(r.score, state.scoreBands);
        if (band?.tier !== tier) return false;
      }
      return true;
    });
  }, [records, query, department, tier, state.scoreBands]);

  if (!activeSheet) return <UploadArea />;

  return (
    <>
      <Card>
        <CardHeader
          title="Student Explorer"
          subtitle={`${filtered.length} of ${records.length} students`}
          actions={
            canEdit && state.datasetVersion !== null ? (
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <Plus size={13} /> Add student
              </Button>
            ) : undefined
          }
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-secondary)] col-span-2 sm:col-span-1">
            Search
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name or registration…"
                className="w-full text-sm rounded-lg border border-[var(--border-strong)] bg-white pl-7 pr-2.5 py-1.5"
              />
            </div>
          </label>
          <Select label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Select label="Performance level" value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="">All levels</option>
            <option value="support">Needs support</option>
            <option value="developing">Developing</option>
            <option value="strong">Strong</option>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--surface-muted,#f2f6fc)] text-left">
                <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Name</th>
                <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Registration</th>
                <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Department</th>
                <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Score</th>
                <th className="px-3 py-2 font-semibold text-[var(--text-secondary)] text-right">Performance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((s, i) => (
                <tr
                  key={i}
                  onClick={() => setSelected(s)}
                  className="border-t border-[var(--border)] hover:bg-[var(--accent-soft)]/40 cursor-pointer"
                >
                  <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{s.name}</td>
                  <td className="px-3 py-2 tabular text-[var(--text-secondary)]">{s.registration}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{s.department}</td>
                  <td className="px-3 py-2 tabular font-semibold">{s.score}</td>
                  <td className="px-3 py-1.5 text-right">
                    <Link
                      href={`/student-performance?student=${encodeURIComponent(s.registration && s.registration !== "—" ? s.registration : s.name)}`}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Performance chart for ${s.name}`}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--accent-strong)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                    >
                      <BarChart3 size={12} /> Chart
                    </Link>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    No students match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <p className="text-[11px] text-[var(--text-muted)] mt-2">Showing the first 100 of {filtered.length} matches — narrow your search to see more precisely.</p>
        )}
      </Card>

      {adding && <RecordEditorModal sheet={activeSheet} rowIndex={null} onClose={() => setAdding(false)} />}
      {selected && <StudentDetailModal student={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
