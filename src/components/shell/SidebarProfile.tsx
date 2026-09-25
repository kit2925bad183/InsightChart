"use client";

import Link from "next/link";
import { User, LogOut } from "lucide-react";
import { ROLES, ROLE_LABELS } from "@/lib/roles";
import { useActingAsRole } from "@/lib/uiPrefs";

export function SidebarProfile({ collapsed, onExpandRequest }: { collapsed: boolean; onExpandRequest?: () => void }) {
  const [role, setRole] = useActingAsRole();

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onExpandRequest}
        aria-label="Show profile"
        className="flex items-center justify-center rounded-full h-9 w-9 mx-auto bg-[var(--accent-soft)] text-[var(--accent-strong)] hover:bg-[var(--accent)] hover:text-white transition-colors"
      >
        <User size={16} />
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 sidebar-label">
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className="flex items-center justify-center rounded-full h-9 w-9 shrink-0 bg-[var(--accent-soft)] text-[var(--accent-strong)]">
          <User size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">Staff Member</p>
          <p className="text-[11px] text-[var(--text-muted)] truncate">{ROLE_LABELS[role]}</p>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-[10px] font-medium text-[var(--text-secondary)] mb-2">
        Acting as
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          className="text-xs rounded-md border border-[var(--border-strong)] bg-white px-2 py-1"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[10px] text-[var(--text-muted)] mb-2.5">Changes what you see in this browser only — InsightChart has no server or accounts.</p>

      <div className="flex items-center justify-between text-xs">
        <Link href="/settings" className="text-[var(--accent-strong)] font-medium hover:underline">
          Settings
        </Link>
        <button
          type="button"
          onClick={() => setRole("administrator")}
          className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--status-critical)]"
          title="Clears the local role selection in this browser — there is no server session to end"
        >
          <LogOut size={12} /> Logout
        </button>
      </div>
    </div>
  );
}
