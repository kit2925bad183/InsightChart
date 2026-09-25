"use client";

import type { StudentRecord } from "@/lib/analysis/stats";
import { departmentAggregates } from "@/lib/analysis/aggregate";
import { Card, CardHeader } from "@/components/ui/Card";

export function DepartmentComparisonTable({ records, passThreshold }: { records: StudentRecord[]; passThreshold: number }) {
  const rows = departmentAggregates(records, passThreshold);
  if (!rows.length) return null;

  return (
    <Card>
      <CardHeader title="Department comparison table" subtitle={`Highest, lowest, and pass rate (at/above ${passThreshold}) per department`} />
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[var(--surface-muted,#f2f6fc)] text-left">
              <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Department</th>
              <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Students</th>
              <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Average</th>
              <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Highest</th>
              <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Lowest</th>
              <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Pass rate</th>
              <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Needs support</th>
              <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Top performer</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.department} className="border-t border-[var(--border)]">
                <td className="px-3 py-1.5 font-medium">{d.department}</td>
                <td className="px-3 py-1.5 tabular">{d.total}</td>
                <td className="px-3 py-1.5 tabular">{d.avg}</td>
                <td className="px-3 py-1.5 tabular text-[var(--status-good)] font-semibold">{d.highest}</td>
                <td className="px-3 py-1.5 tabular text-[var(--status-critical)] font-semibold">{d.lowest}</td>
                <td className="px-3 py-1.5 tabular">{d.passRate}%</td>
                <td className="px-3 py-1.5 tabular">{d.needsSupport}</td>
                <td className="px-3 py-1.5 truncate max-w-[140px]" title={d.topPerformers[0]?.name}>
                  {d.topPerformers[0]?.name ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
