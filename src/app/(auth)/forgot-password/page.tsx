"use client";

import Link from "next/link";
import { VerificationFlow } from "@/components/auth/VerificationFlow";
import { FormMessage } from "@/components/auth/fields";
import { api } from "@/lib/api";
import { AuthFrame } from "@/components/auth/AuthFrame";

export default function ForgotPasswordPage() {
  return (
    <AuthFrame>
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">Reset your password</h1>
      <p className="text-xs text-[var(--text-muted)] mt-1 mb-6">Enter the verified email on your account. We&apos;ll send a one-time code to it.</p>
      <VerificationFlow
        askEmail
        emailLabel="Account email"
        requestCode={(email) =>
          api<{ message: string }>("/api/auth/forgot-password/send-otp", { method: "POST", body: { email }, redirectOn401: false }).then((r) => ({
            message: r.message,
            resendAfterSeconds: 60,
          }))
        }
        verifyCode={(code, email) =>
          api<{ verificationToken: string }>("/api/auth/forgot-password/verify-otp", { method: "POST", body: { email, code }, redirectOn401: false }).then(
            (r) => r.verificationToken
          )
        }
        complete={(verificationToken, password, confirmPassword) =>
          api("/api/auth/forgot-password/complete", { method: "POST", body: { verificationToken, password, confirmPassword }, redirectOn401: false }).then(() => {})
        }
        submitLabel="Reset password"
        doneContent={
          <div className="space-y-4">
            <FormMessage tone="success">Your password has been reset and any signed-in sessions were signed out.</FormMessage>
            <Link href="/login?notice=reset" className="block text-center text-sm font-medium text-[var(--accent-strong)] hover:underline">
              Continue to sign in
            </Link>
          </div>
        }
      />
      <p className="text-center text-xs mt-6">
        <Link href="/login" className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          Back to sign in
        </Link>
      </p>
    </AuthFrame>
  );
}
