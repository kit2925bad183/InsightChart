"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Mail, UploadCloud, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { FormMessage } from "@/components/auth/fields";
import { api } from "@/lib/api";
import { parseFile } from "@/lib/parsers";
import { exportRowsCsv } from "@/lib/export";
import { MAX_BULK_ROWS, TEMPLATE_CSV, parseBulkAccounts, type BulkRow } from "@/lib/bulkAccounts";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";

const BATCH = 10;

type Outcome = { status: "created"; username: string; emailed: boolean; emailError?: string } | { status: "failed"; error: string };

interface ApiResult {
  index: number;
  ok: boolean;
  username?: string;
  error?: string;
  email?: { sent: boolean; error?: string };
}

export function BulkCreateAccounts({
  roles,
  existing,
  allowedDomains,
  onDone,
}: {
  roles: Role[];
  existing: { email: string | null; username: string }[];
  allowedDomains: string[] | null;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<Parameters<typeof parseBulkAccounts>[0] | null>(null);
  const [defaultRole, setDefaultRole] = useState<Role | "">("");
  const [readError, setReadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const [outcomes, setOutcomes] = useState<Map<number, Outcome> | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  // The account list as it was when the file was chosen: after creating, the page reloads
  // the list, and the rows just created must not turn into "already exists".
  const [known, setKnown] = useState(existing);

  const parsed = sheet
    ? parseBulkAccounts(sheet, {
        allowedRoles: roles,
        defaultRole: defaultRole || null,
        existingEmails: known.flatMap((u) => (u.email ? [u.email] : [])),
        existingUsernames: known.map((u) => u.username),
        allowedDomains,
      })
    : null;
  const rows = parsed?.rows ?? [];
  const ready = rows.filter((r) => !r.problems.length);

  const reset = () => {
    setSheet(null);
    setFileName("");
    setOutcomes(null);
    setRunError(null);
    setReadError(null);
  };

  const readFile = async (file: File) => {
    reset();
    setKnown(existing);
    setReading(true);
    try {
      const source = await parseFile(file);
      const first = source.sheets[0];
      if (!first) throw new Error(source.warnings[0] ?? "No table found in this file.");
      setSheet(first);
      setFileName(file.name);
    } catch (err) {
      setReadError(err instanceof Error ? err.message : "Couldn't read this file.");
    } finally {
      setReading(false);
    }
  };

  const create = async () => {
    const todo = ready;
    const results = new Map<number, Outcome>();
    setRunError(null);
    setRunning({ done: 0, total: todo.length });
    try {
      for (let i = 0; i < todo.length; i += BATCH) {
        const batch = todo.slice(i, i + BATCH);
        const { results: res } = await api<{ results: ApiResult[] }>("/api/users/bulk", {
          method: "POST",
          body: { users: batch.map((r) => ({ displayName: r.displayName, email: r.email, role: r.role, username: r.username || undefined })) },
        });
        for (const r of res) {
          const row = batch[r.index];
          results.set(
            row.line,
            r.ok ? { status: "created", username: r.username!, emailed: !!r.email?.sent, emailError: r.email?.error } : { status: "failed", error: r.error ?? "Failed" }
          );
        }
        setOutcomes(new Map(results));
        setRunning({ done: Math.min(i + BATCH, todo.length), total: todo.length });
      }
    } catch (err) {
      setRunError(`${err instanceof Error ? err.message : "Something went wrong."} Accounts listed as created below were created; the rest were not attempted.`);
    } finally {
      setOutcomes(new Map(results));
      setRunning(null);
      onDone();
    }
  };

  const downloadResults = () =>
    exportRowsCsv(
      rows.map((r) => {
        const o = outcomes?.get(r.line);
        return {
          Line: r.line,
          "Full name": r.displayName,
          Email: r.email,
          Role: r.role ? ROLE_LABELS[r.role] : "",
          Username: o?.status === "created" ? o.username : r.username,
          Result: !o
            ? r.problems.length
              ? `Skipped: ${r.problems.join("; ")}`
              : "Not created"
            : o.status === "failed"
              ? `Failed: ${o.error}`
              : o.emailed
                ? "Created, details emailed"
                : `Created, email not sent: ${o.emailError ?? ""}`,
        };
      }),
      `accounts-import-${new Date().toISOString().slice(0, 10)}`
    );

  const created = outcomes ? [...outcomes.values()].filter((o) => o.status === "created") : [];
  const emailFailed = created.filter((o) => o.status === "created" && !o.emailed).length;
  const failed = outcomes ? [...outcomes.values()].filter((o) => o.status === "failed").length : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="primary" onClick={() => inputRef.current?.click()} disabled={reading || !!running}>
          {reading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />} {fileName ? "Choose another file" : "Choose CSV or Excel file"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "insightchart-accounts-template.csv";
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          <Download size={14} /> Download template
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          aria-label="Staff list file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) readFile(f);
          }}
        />
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        Columns: <strong>Full name</strong>, <strong>Email</strong>, <strong>Role</strong> ({roles.map((r) => ROLE_LABELS[r]).join(", ")}), and optionally <strong>Username</strong>. Up to {MAX_BULK_ROWS} people per
        file. Everyone gets a generated password by email and verifies their address at first sign-in.
      </p>

      {readError && <FormMessage tone="error">{readError}</FormMessage>}

      {sheet && parsed && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <p className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
              <FileSpreadsheet size={15} className="text-[var(--accent)]" /> <strong>{fileName}</strong>
            </p>
            <div className="w-56">
              <Select label="Role when the file doesn't say" value={defaultRole} onChange={(e) => setDefaultRole(e.target.value as Role | "")} disabled={!!running || !!outcomes}>
                <option value="">— none (role required) —</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {parsed.fileProblems.length > 0 ? (
            <FormMessage tone="error">
              <span>{parsed.fileProblems.join(" ")}</span>
            </FormMessage>
          ) : (
            <>
              <p className="text-sm text-[var(--text-secondary)]" data-testid="bulk-summary">
                <strong className="text-[var(--text-primary)]">{ready.length}</strong> ready to create
                {rows.length - ready.length > 0 && (
                  <>
                    {" · "}
                    <strong className="text-[var(--status-critical)]">{rows.length - ready.length}</strong> with problems (will be skipped — fix them in the file and choose it again)
                  </>
                )}
              </p>
              <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-xs" aria-label="People to create">
                  <thead className="sticky top-0">
                    <tr className="bg-[var(--surface-muted)] text-left">
                      {["Line", "Full name", "Email", "Role", "Username", "Status"].map((h) => (
                        <th key={h} className="px-3 py-2 font-semibold text-[var(--text-secondary)]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.line} className="border-t border-[var(--border)]">
                        <td className="px-3 py-2 tabular text-[var(--text-muted)]">{r.line}</td>
                        <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{r.displayName || "—"}</td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">{r.email || "—"}</td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">{r.role ? ROLE_LABELS[r.role] : "—"}</td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">
                          {outcomes?.get(r.line)?.status === "created" ? (outcomes.get(r.line) as { username: string }).username : r.username || <span className="text-[var(--text-muted)]">auto</span>}
                        </td>
                        <td className="px-3 py-2">
                          <RowStatus row={r} outcome={outcomes?.get(r.line)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {runError && <FormMessage tone="error">{runError}</FormMessage>}

              {outcomes ? (
                <div className="flex flex-wrap items-center gap-3">
                  <FormMessage tone={failed || emailFailed ? "info" : "success"}>
                    <span data-testid="bulk-result">
                      Created {created.length} account{created.length === 1 ? "" : "s"}
                      {created.length - emailFailed > 0 && ` and emailed ${created.length - emailFailed}`}.
                      {emailFailed > 0 && ` ${emailFailed} email${emailFailed === 1 ? "" : "s"} couldn't be sent — use “Resend login details” in the list below.`}
                      {failed > 0 && ` ${failed} failed (see Status).`}
                    </span>
                  </FormMessage>
                  <Button type="button" variant="outline" size="sm" onClick={downloadResults}>
                    <Download size={13} /> Results CSV
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={reset}>
                    Done
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="primary" onClick={create} disabled={!ready.length || !!running}>
                  {running ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Creating {running.done} of {running.total}…
                    </>
                  ) : (
                    <>
                      <Mail size={14} /> Create {ready.length} account{ready.length === 1 ? "" : "s"} & email details
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function RowStatus({ row, outcome }: { row: BulkRow; outcome?: Outcome }) {
  if (outcome?.status === "created")
    return outcome.emailed ? (
      <span className="inline-flex items-center gap-1 text-[var(--status-good)]">
        <CheckCircle2 size={12} /> Created · emailed
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-[#8a5a00]" title={outcome.emailError}>
        <AlertTriangle size={12} /> Created · email not sent
      </span>
    );
  if (outcome?.status === "failed")
    return (
      <span className="inline-flex items-center gap-1 text-[var(--status-critical)]">
        <XCircle size={12} /> {outcome.error}
      </span>
    );
  if (row.problems.length)
    return (
      <span className="inline-flex items-start gap-1 text-[var(--status-critical)]">
        <XCircle size={12} className="mt-0.5 shrink-0" /> {row.problems.join("; ")}
      </span>
    );
  return <span className="text-[var(--status-good)]">Ready</span>;
}
