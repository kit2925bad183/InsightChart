"use client";

import { useState } from "react";
import Link from "next/link";
import { LogIn, Crown, ShieldCheck, Building2, GraduationCap, ArrowLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormMessage, PasswordField, TextField } from "@/components/auth/fields";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { api, ApiRequestError } from "@/lib/api";
import { safeRedirect } from "@/lib/safeRedirect";

const ROLE_CHOICES: { role: Role; icon: LucideIcon; description: string }[] = [
  { role: "CREATOR_ADMIN", icon: Crown, description: "App owner — full control of the app and every account" },
  { role: "ADMINISTRATOR", icon: ShieldCheck, description: "Upload data, correct marks and records, create HOD & Faculty" },
  { role: "HOD", icon: Building2, description: "View departments and students, download reports" },
  { role: "FACULTY", icon: GraduationCap, description: "View dashboards and students, download reports" },
];

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [role, setRole] = useState<Role | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set when the password was right but the wrong role was picked. */
  const [accountRole, setAccountRole] = useState<Role | null>(null);

  const submit = async (asRole: Role | null = role) => {
    setBusy(true);
    setError(null);
    setAccountRole(null);
    try {
      const r = await api<{ stage: "pending" | "active" }>("/api/auth/login", { method: "POST", body: { identifier, password, role: asRole }, redirectOn401: false });
      window.location.assign(r.stage === "pending" ? "/first-login" : safeRedirect(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      const correct = err instanceof ApiRequestError && err.code === "role_mismatch" ? (err.data?.accountRole as Role | undefined) : undefined;
      if (correct && correct in ROLE_LABELS) setAccountRole(correct);
      setBusy(false);
    }
  };

  if (!role) {
    return (
      <div className="space-y-3">
        {notice && <FormMessage tone="success">{notice}</FormMessage>}
        <p className="text-xs font-medium text-[var(--text-secondary)]">Who is signing in?</p>
        <ul className="grid gap-2" aria-label="Choose your role">
          {ROLE_CHOICES.map(({ role: r, icon: Icon, description }) => (
            <li key={r}>
              <button
                type="button"
                onClick={() => setRole(r)}
                className="w-full flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              >
                <span className="rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)] p-2 shrink-0">
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--text-primary)]">{ROLE_LABELS[r]}</span>
                  <span className="block text-[11px] text-[var(--text-muted)]">{description}</span>
                </span>
                <ChevronRight size={16} className="text-[var(--text-muted)] shrink-0" />
              </button>
            </li>
          ))}
        </ul>
        <p className="text-center text-xs pt-2">
          <Link href="/forgot-password" className="text-[var(--accent-strong)] font-medium hover:underline">
            Forgot password?
          </Link>
        </p>
      </div>
    );
  }

  const choice = ROLE_CHOICES.find((c) => c.role === role)!;
  const Icon = choice.icon;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--accent-soft)] px-3 py-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--accent-strong)]">
          <Icon size={16} /> {ROLE_LABELS[role]}
        </span>
        <button
          type="button"
          onClick={() => {
            setRole(null);
            setError(null);
            setAccountRole(null);
          }}
          className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft size={12} /> Change role
        </button>
      </div>
      {notice && <FormMessage tone="success">{notice}</FormMessage>}
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {accountRole && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={busy}
          onClick={() => {
            setRole(accountRole);
            submit(accountRole);
          }}
        >
          <LogIn size={15} /> Sign in as {ROLE_LABELS[accountRole]} instead
        </Button>
      )}
      <TextField label="Username or email" autoComplete="username" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} disabled={busy} autoFocus />
      <PasswordField label="Password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
      <Button type="submit" variant="primary" className="w-full" disabled={busy || !identifier || !password}>
        <LogIn size={15} /> {busy ? "Signing in…" : `Sign in as ${ROLE_LABELS[role]}`}
      </Button>
      <p className="text-center text-xs">
        <Link href="/forgot-password" className="text-[var(--accent-strong)] font-medium hover:underline">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}
