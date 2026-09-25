"use client";

import { useEffect, useState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormMessage, PasswordField, PASSWORD_RULES_HINT, TextField } from "./fields";
import { ApiRequestError } from "@/lib/api";

type Step = "email" | "code" | "password" | "done";

export interface VerificationFlowProps {
  /** Ask for an email first (first login, forgot password) or send straight to the verified one. */
  askEmail: boolean;
  emailLabel?: string;
  emailHint?: string;
  /** Sends the code; resolves with the address it went to (if the server reveals it). */
  requestCode: (email: string) => Promise<{ sentTo?: string; message?: string; resendAfterSeconds?: number }>;
  verifyCode: (code: string, email: string) => Promise<string>;
  complete: (verificationToken: string, password: string, confirmPassword: string) => Promise<void>;
  submitLabel: string;
  doneContent: React.ReactNode;
}

function errorText(err: unknown) {
  return err instanceof ApiRequestError || err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

/** The shared email → one-time code → new password stepper used by first login,
 * signed-in password change, and forgot password. */
export function VerificationFlow(props: VerificationFlowProps) {
  const [step, setStep] = useState<Step>(props.askEmail ? "email" : "code");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [codeRequested, setCodeRequested] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await props.requestCode(email);
      setInfo(r.message ?? `We sent a 6-digit code to ${r.sentTo ?? email}. It expires in 10 minutes.`);
      setCooldown(r.resendAfterSeconds ?? 60);
      setCodeRequested(true);
      setCode("");
      setStep("code");
    } catch (err) {
      setError(errorText(err));
      const retry = err instanceof ApiRequestError ? Number(err.data?.retryAfterSeconds) : NaN;
      if (Number.isFinite(retry) && retry > 0) setCooldown(retry);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      setToken(await props.verifyCode(code, email));
      setInfo(null);
      setStep("password");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setError(null);
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await props.complete(token, password, confirm);
      setStep("done");
    } catch (err) {
      const e = err as ApiRequestError;
      // An expired/used verification means starting over from the code step.
      if (e?.code === "otp_session_invalid") {
        setStep(props.askEmail ? "email" : "code");
        setCodeRequested(false);
      }
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (step === "done") return <>{props.doneContent}</>;

  return (
    <div className="space-y-4">
      <ol className="flex gap-2 text-[11px] font-medium" aria-label="Progress">
        {(props.askEmail ? ["Email", "Code", "New password"] : ["Code", "New password"]).map((label, i, all) => {
          const current = all.length === 3 ? ["email", "code", "password"].indexOf(step) : ["code", "password"].indexOf(step);
          return (
            <li
              key={label}
              aria-current={i === current ? "step" : undefined}
              className={`flex-1 rounded-full px-2 py-1 text-center ${i <= current ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "bg-[var(--surface-muted)] text-[var(--text-muted)]"}`}
            >
              {i + 1}. {label}
            </li>
          );
        })}
      </ol>

      {error && <FormMessage tone="error">{error}</FormMessage>}
      {info && step === "code" && <FormMessage tone="info">{info}</FormMessage>}

      {step === "email" && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <TextField
            label={props.emailLabel ?? "Email address"}
            hint={props.emailHint}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <Button type="submit" variant="primary" className="w-full" disabled={busy || !email.trim() || cooldown > 0}>
            <MailCheck size={15} /> {busy ? "Sending code…" : cooldown > 0 ? `Send code (wait ${cooldown}s)` : "Send verification code"}
          </Button>
        </form>
      )}

      {step === "code" && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
        >
          {!codeRequested ? (
            <Button type="button" variant="primary" className="w-full" onClick={send} disabled={busy || cooldown > 0}>
              <MailCheck size={15} /> {busy ? "Sending code…" : "Email me a verification code"}
            </Button>
          ) : (
            <>
              <TextField
                label="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                disabled={busy}
                className="tracking-[0.4em] font-mono text-center text-lg"
              />
              <Button type="submit" variant="primary" className="w-full" disabled={busy || code.length !== 6}>
                {busy ? "Checking…" : "Verify code"}
              </Button>
              <div className="flex justify-between text-xs">
                {props.askEmail ? (
                  <button type="button" className="text-[var(--text-muted)] hover:text-[var(--text-primary)]" onClick={() => setStep("email")}>
                    Use a different email
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" className="text-[var(--accent-strong)] font-medium disabled:opacity-50" onClick={send} disabled={busy || cooldown > 0}>
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {step === "password" && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            finish();
          }}
        >
          <FormMessage tone="success">Code verified. Now choose your new password.</FormMessage>
          <PasswordField label="New password" hint={PASSWORD_RULES_HINT} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
          <PasswordField label="Confirm new password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={busy} />
          <Button type="submit" variant="primary" className="w-full" disabled={busy || !password || !confirm}>
            {busy ? "Saving…" : props.submitLabel}
          </Button>
        </form>
      )}
    </div>
  );
}
