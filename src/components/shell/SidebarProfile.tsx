"use client";

import { useState } from "react";
import Link from "next/link";
import { User, LogOut } from "lucide-react";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/session";
import { api } from "@/lib/api";

export async function signOut() {
  try {
    await api("/api/auth/logout", { method: "POST", redirectOn401: false });
  } finally {
    // Full navigation so every in-memory copy of the dataset is dropped with the session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate full reload at a session boundary so no in-memory data from the previous session survives
    window.location.assign("/login");
  }
}

export function SidebarProfile({ collapsed, onExpandRequest }: { collapsed: boolean; onExpandRequest?: () => void }) {
  const { user } = useSession();
  const [signingOut, setSigningOut] = useState(false);

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
          <p className="text-xs font-semibold text-[var(--text-primary)] truncate" data-testid="profile-name">
            {user.displayName}
          </p>
          <p className="text-[11px] text-[var(--text-muted)] truncate" data-testid="profile-role">
            {ROLE_LABELS[user.role]}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-3">
          <Link href="/account" className="text-[var(--accent-strong)] font-medium hover:underline">
            Account
          </Link>
          <Link href="/settings" className="text-[var(--accent-strong)] font-medium hover:underline">
            Settings
          </Link>
        </div>
        <button
          type="button"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            signOut();
          }}
          className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--status-critical)] disabled:opacity-50"
        >
          <LogOut size={12} /> {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
