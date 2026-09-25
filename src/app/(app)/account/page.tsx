"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Select";
import { FormMessage } from "@/components/auth/fields";
import { VerificationFlow } from "@/components/auth/VerificationFlow";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/session";
import { api } from "@/lib/api";

export default function AccountPage() {
  const { user } = useSession();
  const [changing, setChanging] = useState(false);
  const [flowKey, setFlowKey] = useState(0);

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader title="My account" subtitle="Your sign-in details" />
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-[var(--text-muted)]">Name</dt>
          <dd className="font-medium text-[var(--text-primary)]">{user.displayName}</dd>
          <dt className="text-[var(--text-muted)]">Username</dt>
          <dd className="font-medium text-[var(--text-primary)]">{user.username}</dd>
          <dt className="text-[var(--text-muted)]">Role</dt>
          <dd>
            <Badge tone="accent">{ROLE_LABELS[user.role]}</Badge>
          </dd>
          <dt className="text-[var(--text-muted)]">Email</dt>
          <dd className="flex items-center gap-2 font-medium text-[var(--text-primary)] min-w-0">
            <span className="truncate">{user.email ?? "—"}</span>
            {user.emailVerified && (
              <Badge tone="good">
                <ShieldCheck size={11} /> Verified
              </Badge>
            )}
          </dd>
        </dl>
        <p className="text-[11px] text-[var(--text-muted)] mt-3">Your role can only be changed by an administrator — never from your own account.</p>
      </Card>

      <Card>
        <CardHeader
          title="Change password"
          subtitle={
            user.mustChangePassword
              ? "You're still using your initial password. Verify your email with a one-time code and choose your own."
              : `We'll email a one-time code to ${user.email ?? "your verified email"} to confirm it's you.`
          }
        />
        {user.mustChangePassword ? (
          <Link
            href="/first-login"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-white hover:bg-[var(--accent-strong)]"
          >
            <KeyRound size={15} /> Change password by email
          </Link>
        ) : !changing ? (
          <Button variant="primary" onClick={() => setChanging(true)} disabled={!user.emailVerified}>
            <KeyRound size={15} /> Change password
          </Button>
        ) : (
          <VerificationFlow
            key={flowKey}
            askEmail={false}
            requestCode={() =>
              api<{ email: string; resendAfterSeconds: number }>("/api/auth/password/send-otp", { method: "POST" }).then((r) => ({
                sentTo: r.email,
                resendAfterSeconds: r.resendAfterSeconds,
              }))
            }
            verifyCode={(code) => api<{ verificationToken: string }>("/api/auth/password/verify-otp", { method: "POST", body: { code } }).then((r) => r.verificationToken)}
            complete={(verificationToken, password, confirmPassword) =>
              api("/api/auth/password/complete", { method: "POST", body: { verificationToken, password, confirmPassword } }).then(() => {})
            }
            submitLabel="Change password"
            doneContent={
              <div className="space-y-3">
                <FormMessage tone="success">Password changed. Other devices signed in to your account have been signed out.</FormMessage>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setChanging(false);
                    setFlowKey((k) => k + 1);
                  }}
                >
                  Done
                </Button>
              </div>
            }
          />
        )}
      </Card>
    </div>
  );
}
