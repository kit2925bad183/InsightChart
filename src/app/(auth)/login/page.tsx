import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { AuthFrame } from "@/components/auth/AuthFrame";

export const metadata: Metadata = { title: "Sign in — InsightChart" };

const NOTICES: Record<string, string> = {
  reset: "Your password has been reset. Sign in with your new password.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const { next, notice } = await searchParams;
  return (
    <AuthFrame branded>
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">Sign in</h1>
      <p className="text-xs text-[var(--text-muted)] mt-1 mb-6">Choose your role, then use the username and password you were given.</p>
      <LoginForm next={next} notice={notice ? NOTICES[notice] : undefined} />
    </AuthFrame>
  );
}
