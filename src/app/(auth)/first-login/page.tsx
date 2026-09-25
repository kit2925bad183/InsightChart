import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPageSession } from "@/server/pageSession";
import { allowedEmailDomains } from "@/server/users";
import { emailConfigError } from "@/server/email/mailer";
import { hasRegisteredEmail } from "@/server/auth/service";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { FirstLoginFlow } from "./FirstLoginFlow";
import { AuthFrame } from "@/components/auth/AuthFrame";

export const metadata: Metadata = { title: "Your password — InsightChart" };

export default async function FirstLoginPage() {
  const ctx = await getPageSession();
  if (!ctx) redirect("/login");
  if (!ctx.user.must_change_password) redirect("/dashboard");
  const { user } = ctx;
  // Administrator-created accounts must confirm the email their details were sent to; the
  // two initial accounts register their own email here.
  const presetEmail = hasRegisteredEmail(user);

  return (
    <AuthFrame>
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">Welcome, {user.display_name}</h1>
      <p className="text-xs text-[var(--text-muted)] mt-1 mb-6">
        Signed in as <span className="font-medium">{user.username}</span> ({ROLE_LABELS[user.role]}). You&apos;re using the initial password you were given.
      </p>
      <FirstLoginFlow
        presetEmail={presetEmail}
        allowedDomains={allowedEmailDomains()}
        emailProblem={emailConfigError()}
        signedInAlready={ctx.session.stage === "active"}
      />
    </AuthFrame>
  );
}
