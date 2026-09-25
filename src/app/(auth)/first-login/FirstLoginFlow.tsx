"use client";

import { useState } from "react";
import { MailCheck, ArrowRight, ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/auth/fields";
import { VerificationFlow } from "@/components/auth/VerificationFlow";
import { api } from "@/lib/api";

function goTo(path: string) {
  window.location.assign(path);
}

const choiceClass =
  "w-full flex items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-60 disabled:cursor-not-allowed";

export function FirstLoginFlow({
  presetEmail,
  allowedDomains,
  emailProblem,
  signedInAlready,
}: {
  presetEmail: boolean;
  allowedDomains: string[] | null;
  /** Non-null when the server can't send email — the email option is then unavailable. */
  emailProblem: string | null;
  /** Opened later from My Account rather than straight after sign-in. */
  signedInAlready: boolean;
}) {
  const [mode, setMode] = useState<"choose" | "email">("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const domainHint = allowedDomains ? `Must be a ${allowedDomains.map((d) => "@" + d).join(" or ")} address you can open right now.` : "An address you can open right now.";

  const continueWithCurrent = async () => {
    if (signedInAlready) return goTo("/dashboard");
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/first-login/continue", { method: "POST" });
      goTo("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't continue. Please sign in again.");
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    await api("/api/auth/logout", { method: "POST", redirectOn401: false }).catch(() => {});
    goTo("/login");
  };

  if (mode === "choose") {
    return (
      <div className="space-y-3">
        <p className="text-xs font-medium text-[var(--text-secondary)]">What would you like to do?</p>
        {error && <FormMessage tone="error">{error}</FormMessage>}

        <button
          type="button"
          disabled={!!emailProblem || busy}
          onClick={() => setMode("email")}
          className={`${choiceClass} border-[var(--accent)] bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]`}
        >
          <span className="rounded-lg bg-[var(--accent)] text-white p-2 shrink-0">
            <MailCheck size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[var(--text-primary)]">Change password by email</span>
            <span className="block text-[11px] text-[var(--text-secondary)] mt-0.5">
              Recommended. We email you a 6-digit code, then you choose a new password. Your email is also saved so you can use &quot;Forgot password&quot; later.
            </span>
          </span>
        </button>
        {emailProblem && <FormMessage tone="error">{emailProblem}</FormMessage>}

        <button type="button" disabled={busy} onClick={continueWithCurrent} className={`${choiceClass} border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]`}>
          <span className="rounded-lg bg-[var(--surface-muted)] text-[var(--text-secondary)] p-2 shrink-0">
            <ArrowRight size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[var(--text-primary)]">{busy ? "Continuing…" : "Continue with current password"}</span>
            <span className="block text-[11px] text-[var(--text-muted)] mt-0.5">
              Keep the password you signed in with for now. We&apos;ll offer this again next time — you can change it any time from My Account.
            </span>
          </span>
        </button>

        <div className="pt-3 text-center">
          <Button variant="ghost" size="sm" disabled={busy} onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <KeyRound size={15} /> Change password by email
        </p>
        <button type="button" onClick={() => setMode("choose")} className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft size={12} /> Back
        </button>
      </div>
      <VerificationFlow
        askEmail
        emailLabel={presetEmail ? "Your registered email address" : "Your Gmail address"}
        emailHint={
          presetEmail
            ? "Enter the email your administrator registered for you — it has to match. We'll send a code there."
            : `${domainHint} It becomes your account's verified email, used for password resets.`
        }
        requestCode={(email) =>
          api<{ email: string; resendAfterSeconds: number }>("/api/auth/first-login/send-otp", { method: "POST", body: { email } }).then((r) => ({
            sentTo: r.email,
            resendAfterSeconds: r.resendAfterSeconds,
          }))
        }
        verifyCode={(code) => api<{ verificationToken: string }>("/api/auth/first-login/verify-otp", { method: "POST", body: { code } }).then((r) => r.verificationToken)}
        complete={(verificationToken, password, confirmPassword) =>
          api("/api/auth/first-login/complete", { method: "POST", body: { verificationToken, password, confirmPassword } }).then(() => goTo("/dashboard"))
        }
        submitLabel="Set new password and continue"
        doneContent={<FormMessage tone="success">Password changed — taking you to your dashboard…</FormMessage>}
      />
    </>
  );
}
