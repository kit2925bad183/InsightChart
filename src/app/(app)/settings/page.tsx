"use client";

import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { Card, CardHeader } from "@/components/ui/Card";
import { SettingsPanel } from "@/components/dashboard/SettingsPanel";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/session";

export default function SettingsPage() {
  const { activeSheet } = useApp();
  const { user, can } = useSession();

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader title="Your access" subtitle="Set by your account's role" />
        <p className="text-sm text-[var(--text-primary)]">
          Signed in as <span className="font-semibold">{user.displayName}</span> ({ROLE_LABELS[user.role]}).
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {can("records:edit")
            ? "You can upload data and correct marks, names and other student details. Changes are saved for everyone."
            : "You can view everything and download reports. Records can only be changed by an Administrator."}
        </p>
        <p className="text-xs mt-3">
          <Link href="/account" className="text-[var(--accent-strong)] font-medium hover:underline">
            Manage your password and email →
          </Link>
        </p>
      </Card>
      {activeSheet && <SettingsPanel />}
    </div>
  );
}
