"use client";

import { useMemo, useRef } from "react";
import { FileImage } from "lucide-react";
import type { StudentRecord } from "@/lib/analysis/stats";
import type { ScoreBand } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DepartmentReportCard } from "@/components/dashboard/DepartmentReportCard";
import { exportChartPng } from "@/lib/export";
import { departmentFullName } from "@/lib/analysis/normalizeDepartment";

export function DepartmentReports({
  records,
  bands,
  subtitle,
}: {
  records: StudentRecord[];
  bands: ScoreBand[];
  subtitle: string;
}) {
  const allRef = useRef<HTMLDivElement>(null);

  const departments = useMemo(() => {
    const map = new Map<string, StudentRecord[]>();
    for (const r of records) {
      if (!r.department || r.department === "—") continue;
      if (!map.has(r.department)) map.set(r.department, []);
      map.get(r.department)!.push(r);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([code, recs]) => ({ code, fullName: departmentFullName(code), records: recs }));
  }, [records]);

  if (!departments.length) {
    return (
      <Card>
        <CardHeader title="Department reports" />
        <p className="text-sm text-[var(--text-muted)]">Map a department / group column to generate per-department report cards.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Department reports</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">One score-distribution report per department, ready to export</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => allRef.current && exportChartPng(allRef.current, "all-department-reports")}>
          <FileImage size={14} /> Export all as one image
        </Button>
      </div>
      <div ref={allRef} className="grid xl:grid-cols-2 gap-5 bg-[var(--page-bg-2)] p-0.5 rounded-2xl">
        {departments.map((d) => (
          <DepartmentReportCard key={d.code} code={d.code} fullName={d.fullName} subtitle={subtitle} records={d.records} bands={bands} />
        ))}
      </div>
    </div>
  );
}
