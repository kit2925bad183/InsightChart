"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, UploadCloud, X, BarChart3, Database, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { useApp, useRecords } from "@/context/AppContext";
import { PRIMARY_ID, useAssessmentFiles } from "@/context/AssessmentFilesContext";
import { useSession } from "@/lib/auth/session";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Select";
import { FormMessage } from "@/components/auth/fields";
import { StudentPerformanceChart, type ChartView } from "@/components/dashboard/StudentPerformanceChart";
import { buildStudentProgress, COMPARE_BY_LABELS, dateFromFileName, findStudent, groupProgress, searchStudents, type AssessmentInput, type CompareBy } from "@/lib/analysis/studentProgress";
import { deriveAssessmentTitle } from "@/lib/analysis/reportMeta";
import { SUPPORTED_EXTENSIONS } from "@/lib/parsers";

function StudentPerformance() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedKey = params.get("student") ?? "";
  const byParam = params.get("by") as CompareBy | null;
  const by: CompareBy = byParam && byParam in COMPARE_BY_LABELS ? byParam : "test";
  const view: ChartView = params.get("view") === "bar" ? "bar" : "line";
  const { state } = useApp();
  const { can } = useSession();
  const records = useRecords();
  const { files, order, primaryDate, loading, errors, addFiles, removeFile, renameFile, setDate, move, clearErrors } = useAssessmentFiles();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const primaryLabel = state.source?.kind === "mock" ? "Sample data" : deriveAssessmentTitle(state.source?.fileName ?? "") || state.source?.fileName || "Current dataset";

  const primaryDateValue = primaryDate ?? (state.source?.kind === "mock" ? "" : dateFromFileName(state.source?.fileName ?? ""));

  // Every assessment in the user's test-wise order; the shared dataset can sit anywhere in it.
  const assessments: AssessmentInput[] = useMemo(() => {
    const byId = new Map<string, AssessmentInput>([[PRIMARY_ID, { id: PRIMARY_ID, label: primaryLabel, records, date: primaryDateValue }]]);
    for (const f of files) byId.set(f.id, { id: f.id, label: f.label || f.fileName, records: f.records, date: f.date });
    return order.flatMap((id) => byId.get(id) ?? []);
  }, [primaryLabel, primaryDateValue, records, files, order]);

  const matches = useMemo(() => {
    const seen = new Map<string, (typeof records)[number]>();
    for (const a of assessments) for (const r of searchStudents(a.records, query, 20)) if (!seen.has(`${r.registration}|${r.name}`)) seen.set(`${r.registration}|${r.name}`, r);
    return Array.from(seen.values()).slice(0, 20);
  }, [assessments, query]);

  // The selected student is identified by register number (or name) in the URL, so the
  // Student Explorer's "Chart" button can link straight here.
  const selected = useMemo(() => {
    if (!selectedKey) return null;
    for (const a of assessments) {
      const found = findStudent(a.records, { name: selectedKey, registration: selectedKey });
      if (found && "record" in found) return found.record;
    }
    return null;
  }, [assessments, selectedKey]);

  const grouped = useMemo(
    () => groupProgress(selected ? buildStudentProgress({ name: selected.name, registration: selected.registration }, assessments) : [], by),
    [selected, assessments, by]
  );

  // Student, compare-by and chart type live in the URL so a view can be bookmarked or shared.
  const setParams = (next: Record<string, string>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) q.set(k, v);
    router.replace(`/student-performance?${q.toString()}`, { scroll: false });
  };

  const pick = (key: string) => {
    setQuery("");
    setParams({ student: key });
  };

  return (
    <>
      <Card>
        <CardHeader title="Student performance" subtitle="Search one student by name or register number to chart their scores across assessments" />
        <div className="relative max-w-xl">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or register number…"
            aria-label="Search student by name or register number"
            className="w-full text-sm rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] pl-8 pr-3 py-2 text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          />
        </div>
        {query.trim() && (
          <ul className="mt-2 max-w-xl max-h-72 overflow-y-auto rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]" aria-label="Matching students">
            {matches.map((r) => {
              const key = r.registration && r.registration !== "—" ? r.registration : r.name;
              return (
                <li key={`${r.registration}|${r.name}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium text-[var(--text-primary)]">{r.name}</span>
                    <span className="text-xs text-[var(--text-muted)]"> · {r.registration} · {r.department}</span>
                  </span>
                  <Button size="sm" variant="outline" onClick={() => pick(key)} aria-label={`Chart ${r.name}`}>
                    <BarChart3 size={13} /> Chart
                  </Button>
                </li>
              );
            })}
            {!matches.length && <li className="px-3 py-3 text-sm text-[var(--text-muted)]">No student matches “{query.trim()}”.</li>}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Assessments to compare"
          subtitle="Add two or more files (e.g. Test 1, Test 2, Model exam). Arrows set the test-wise order; dates drive the day, week and month-wise views. Files are read in your browser only."
          actions={
            <Button size="sm" variant="primary" onClick={() => inputRef.current?.click()} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />} {loading ? "Reading…" : "Add files"}
            </Button>
          }
        />
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={SUPPORTED_EXTENSIONS.join(",")}
          className="hidden"
          aria-label="Add assessment files"
          onChange={(e) => {
            const list = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (list.length) addFiles(list);
          }}
        />
        {errors.length > 0 && (
          <div className="mb-3">
            <FormMessage tone="error">
              <span>Some files couldn&apos;t be used: {errors.join("; ")}</span>{" "}
              <button onClick={clearErrors} className="underline">
                Dismiss
              </button>
            </FormMessage>
          </div>
        )}
        <ol className="space-y-2">
          {assessments.map((a, i) => {
            const file = files.find((f) => f.id === a.id);
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                <span className="text-xs font-semibold text-[var(--text-muted)] w-5">{i + 1}.</span>
                {file ? (
                  <input
                    value={file.label}
                    onChange={(e) => renameFile(file.id, e.target.value)}
                    aria-label={`Name for ${file.fileName}`}
                    title={file.fileName}
                    className="flex-1 min-w-32 rounded border border-transparent hover:border-[var(--border)] focus:border-[var(--border-strong)] bg-transparent px-1.5 py-0.5 font-medium text-[var(--text-primary)]"
                  />
                ) : (
                  <>
                    <Database size={14} className="text-[var(--accent)] shrink-0" />
                    <span className="font-medium text-[var(--text-primary)] truncate flex-1 min-w-32">{a.label}</span>
                    <Badge tone="accent">Shared dataset</Badge>
                  </>
                )}
                <input
                  type="date"
                  value={a.date}
                  onChange={(e) => setDate(a.id, e.target.value)}
                  aria-label={`Date of ${a.label}`}
                  title="Date the test was held, used for the day, week and month-wise views"
                  className={`text-xs rounded border px-1.5 py-0.5 bg-transparent text-[var(--text-secondary)] ${a.date ? "border-[var(--border)]" : "border-[var(--series-4)]"}`}
                />
                {file && <span className="text-[11px] text-[var(--text-muted)] shrink-0">{file.records.length} students</span>}
                <span className="flex items-center shrink-0">
                  <button onClick={() => move(a.id, -1)} disabled={i === 0} aria-label={`Move ${a.label} earlier`} className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--accent-soft)] disabled:opacity-30">
                    <ArrowUp size={14} />
                  </button>
                  <button onClick={() => move(a.id, 1)} disabled={i === assessments.length - 1} aria-label={`Move ${a.label} later`} className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--accent-soft)] disabled:opacity-30">
                    <ArrowDown size={14} />
                  </button>
                  {file && (
                    <button onClick={() => removeFile(file.id)} aria-label={`Remove ${file.label}`} className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--status-critical)] hover:bg-[var(--status-critical-soft)]">
                      <X size={14} />
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
        {!files.length && <p className="text-xs text-[var(--text-muted)] mt-2">Add at least one more file to compare against the shared dataset.</p>}
        {files.length > 0 && assessments.some((a) => !a.date) && (
          <p className="text-xs text-[var(--text-muted)] mt-2">Tip: set a date on every file (highlighted) to compare day, week or month-wise.</p>
        )}
      </Card>

      {selectedKey && !selected && <FormMessage tone="error">No student “{selectedKey}” was found in these assessments.</FormMessage>}
      {selected && (
        <StudentPerformanceChart
          name={selected.name}
          registration={selected.registration}
          rows={grouped.rows}
          undated={grouped.undated}
          by={by}
          view={view}
          onByChange={(v) => setParams({ by: v })}
          onViewChange={(v) => setParams({ view: v })}
          canDownload={can("reports:download")}
        />
      )}
      {!selectedKey && (
        <div className="card p-8 text-center text-sm text-[var(--text-muted)]">Search for a student above and click <strong>Chart</strong> to see their performance.</div>
      )}
    </>
  );
}

export default function StudentPerformancePage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="card p-8 text-center text-sm text-[var(--text-muted)]">Loading…</div>}>
      <StudentPerformance />
    </Suspense>
  );
}
