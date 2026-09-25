"use client";

import Link from "next/link";
import { UploadCloud, UserCog, FileDown, Users2, Scale, KeyRound } from "lucide-react";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/session";
import { useApp } from "@/context/AppContext";

const linkClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)]";

/** Top-of-dashboard strip tailored to the signed-in role: editors get their management
 * shortcuts, view-only roles get the views and downloads they can use. */
export function RoleWelcome() {
  const { user, can } = useSession();
  const { state } = useApp();
  const firstName = user.displayName.split(" ")[0];

  const dataLine =
    state.datasetVersion === null
      ? can("records:edit")
        ? "No dataset is published yet — you're looking at sample data. Upload a file to publish one for everyone."
        : "No dataset has been published yet — this is sample data until an Administrator uploads one."
      : `Showing ${state.source?.fileName ?? "the shared dataset"}${state.datasetUpdatedBy ? `, last updated by ${state.datasetUpdatedBy}` : ""}${
          state.datasetUpdatedAt ? ` on ${new Date(state.datasetUpdatedAt).toLocaleDateString()}` : ""
        }.`;

  return (
    <>
      {user.mustChangePassword && (
        <div
          role="status"
          className="rounded-lg border border-[var(--status-warning)] bg-[var(--status-warning-soft)] px-3 py-2.5 text-xs text-[var(--text-primary)] flex flex-wrap items-center gap-2 justify-between"
        >
          <span>You&apos;re still using your initial password. Change it by email so only you know it.</span>
          <Link href="/first-login" className="inline-flex items-center gap-1 font-semibold text-[var(--accent-strong)] hover:underline">
            <KeyRound size={13} /> Change password
          </Link>
        </div>
      )}
      <section className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between" aria-label="Your workspace">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Welcome, {firstName} <span className="font-normal text-[var(--text-muted)]">· {ROLE_LABELS[user.role]}</span>
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{dataLine}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {can("records:edit") && (
            <Link href="/upload" className={linkClass}>
              <UploadCloud size={13} /> Upload & correct data
            </Link>
          )}
          {can("users:view") && (
            <Link href="/admin/users" className={linkClass}>
              <UserCog size={13} /> Manage users
            </Link>
          )}
          {!can("records:edit") && (
            <Link href="/students" className={linkClass}>
              <Users2 size={13} /> Browse students
            </Link>
          )}
          {!can("records:edit") && can("analysis:departments") && (
            <Link href="/departments" className={linkClass}>
              <Scale size={13} /> Compare departments
            </Link>
          )}
          {can("reports:download") && (
            <Link href="/reports" className={linkClass}>
              <FileDown size={13} /> Download reports
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
