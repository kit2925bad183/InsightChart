"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { UploadCloud, X, FileImage } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { parseFile } from "@/lib/parsers";
import { inferColumns, detectMapping } from "@/lib/analysis/inferColumns";
import { toStudentRecords, mean, round1, type StudentRecord } from "@/lib/analysis/stats";
import { categoricalVar } from "@/lib/palette";
import { exportChartPng } from "@/lib/export";
import type { ParsedSource } from "@/lib/types";

export function AssessmentComparison({
  fileALabel,
  recordsA,
  normalizeDepartments,
}: {
  fileALabel: string;
  recordsA: StudentRecord[];
  normalizeDepartments: boolean;
}) {
  const [otherSource, setOtherSource] = useState<ParsedSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      try {
        const source = await parseFile(file);
        if (!source.sheets.length) {
          setError(source.warnings[0] ?? "Could not read this file.");
        } else {
          setOtherSource(source);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read this file.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const recordsB = useMemo(() => {
    if (!otherSource?.sheets.length) return [];
    const sheet = otherSource.sheets[0];
    const columns = inferColumns(sheet);
    const mapping = detectMapping(sheet, columns);
    return toStudentRecords(sheet, mapping, normalizeDepartments);
  }, [otherSource, normalizeDepartments]);

  const comparison = useMemo(() => {
    const depts = new Set([...recordsA.map((r) => r.department), ...recordsB.map((r) => r.department)]);
    return Array.from(depts)
      .filter((d) => d && d !== "—")
      .map((dept) => {
        const a = recordsA.filter((r) => r.department === dept).map((r) => r.score);
        const b = recordsB.filter((r) => r.department === dept).map((r) => r.score);
        return {
          department: dept,
          avgA: a.length ? round1(mean(a)) : 0,
          avgB: b.length ? round1(mean(b)) : 0,
          countA: a.length,
          countB: b.length,
        };
      })
      .sort((a, b) => a.department.localeCompare(b.department));
  }, [recordsA, recordsB]);

  return (
    <Card>
      <CardHeader
        title="Compare with another assessment"
        subtitle="Upload a second file to see department-level score trends between them"
        actions={
          otherSource && (
            <>
              <Button size="sm" variant="ghost" onClick={() => reportRef.current && exportChartPng(reportRef.current, "assessment-comparison")}>
                <FileImage size={14} /> PNG
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOtherSource(null)} aria-label="Remove comparison file">
                <X size={14} /> Remove
              </Button>
            </>
          )
        }
      />

      {!otherSource && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border-strong)] hover:border-[var(--accent)] p-6 text-center cursor-pointer transition-colors"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <UploadCloud size={22} className="text-[var(--accent)]" />
          <p className="text-xs text-[var(--text-secondary)]">{loading ? "Reading file…" : "Click to upload a second assessment"}</p>
          {error && <p className="text-xs text-[var(--status-critical)]">{error}</p>}
        </div>
      )}

      {otherSource && (
        <div ref={reportRef} className="bg-[var(--surface)]">
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Comparing <span className="font-semibold text-[var(--text-primary)]">{fileALabel}</span> ({recordsA.length} students) with{" "}
            <span className="font-semibold text-[var(--text-primary)]">{otherSource.fileName}</span> ({recordsB.length} students)
          </p>
          {comparison.length ? (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={comparison} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="var(--gridline)" vertical={false} />
                  <XAxis dataKey="department" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} cursor={{ fill: "var(--accent-soft)" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="avgA" name={fileALabel} fill={categoricalVar[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="avgB" name="This file" fill={categoricalVar[1]} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>

              <div className="overflow-x-auto rounded-lg border border-[var(--border)] mt-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[var(--surface-muted,#f2f6fc)] text-left">
                      <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Department</th>
                      <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">{fileALabel} avg</th>
                      <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">This file avg</th>
                      <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((c) => {
                      const delta = round1(c.avgB - c.avgA);
                      return (
                        <tr key={c.department} className="border-t border-[var(--border)]">
                          <td className="px-3 py-1.5 font-medium">{c.department}</td>
                          <td className="px-3 py-1.5 tabular">{c.avgA}</td>
                          <td className="px-3 py-1.5 tabular">{c.avgB}</td>
                          <td className="px-3 py-1.5 tabular font-semibold" style={{ color: delta >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                            {delta >= 0 ? "+" : ""}
                            {delta}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">No matching departments found between the two files.</p>
          )}
        </div>
      )}
    </Card>
  );
}
