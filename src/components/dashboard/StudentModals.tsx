"use client";

import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useState } from "react";
import Link from "next/link";
import { Download, Pencil, BarChart3 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { RecordEditorModal } from "@/components/data/RecordEditorModal";
import type { ScoreBand } from "@/lib/types";
import type { StudentRecord } from "@/lib/analysis/stats";
import { fmt } from "@/lib/analysis/stats";
import { exportRowsCsv } from "@/lib/export";
import { tierColorVar } from "@/lib/palette";

export function StudentListModal({
  band,
  students,
  onClose,
  onSelectStudent,
  extraFields,
}: {
  band: ScoreBand;
  students: StudentRecord[];
  onClose: () => void;
  onSelectStudent: (s: StudentRecord) => void;
  extraFields: string[];
}) {
  const tierLabel = band.tier === "support" ? "Needs support" : band.tier === "developing" ? "Developing" : "Strong";
  return (
    <Modal title={`Students scoring ${band.label}`} subtitle={`${students.length} student${students.length === 1 ? "" : "s"} · ${tierLabel}`} onClose={onClose} width="lg">
      <div className="flex justify-end mb-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            exportRowsCsv(
              students.map((s) => ({ Name: s.name, Registration: s.registration, Department: s.department, Score: s.score })),
              `students-${band.label.replace(/[^0-9]/g, "-")}`
            )
          }
        >
          <Download size={13} /> Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[var(--surface-muted,#f2f6fc)] text-left">
              <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Name</th>
              <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Registration No</th>
              <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Department</th>
              <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Score</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={i} className="border-t border-[var(--border)] hover:bg-[var(--accent-soft)]/40 cursor-pointer" onClick={() => onSelectStudent(s)}>
                <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{s.name}</td>
                <td className="px-3 py-2 tabular text-[var(--text-secondary)]">{s.registration}</td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">{s.department}</td>
                <td className="px-3 py-2 tabular font-semibold" style={{ color: tierColorVar[band.tier] }}>
                  {s.score}
                </td>
              </tr>
            ))}
            {!students.length && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[var(--text-muted)]">
                  No students in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {extraFields.length > 0 && <p className="text-[11px] text-[var(--text-muted)] mt-2">Click a row to see full assessment details.</p>}
    </Modal>
  );
}

export function StudentDetailModal({ student, onClose }: { student: StudentRecord; onClose: () => void }) {
  const { state, activeSheet, canEdit } = useApp();
  const [editing, setEditing] = useState(false);
  const entries = Object.entries(student.row).filter(([, v]) => v !== null && v !== undefined && v !== "");
  const rowIndex = activeSheet ? activeSheet.rows.indexOf(student.row) : -1;
  const editable = canEdit && state.datasetVersion !== null && rowIndex !== -1;

  if (editing && activeSheet) return <RecordEditorModal sheet={activeSheet} rowIndex={rowIndex} onClose={onClose} />;

  return (
    <Modal title={student.name} subtitle={`${student.registration} · ${student.department}`} onClose={onClose} width="md">
      <div className="flex items-center gap-2 mb-4">
        <Badge tone="accent">Score {student.score}</Badge>
        <Link
          href={`/student-performance?student=${encodeURIComponent(student.registration && student.registration !== "—" ? student.registration : student.name)}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-strong)] hover:underline"
        >
          <BarChart3 size={13} /> Performance chart
        </Link>
        {editable && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setEditing(true)}>
            <Pencil size={13} /> Edit record
          </Button>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs" aria-label="Full assessment details">
        {entries.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[var(--text-muted)]">{k}</dt>
            <dd className="text-[var(--text-primary)] font-medium tabular">{fmt(v)}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
