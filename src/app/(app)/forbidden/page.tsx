import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <div className="card p-10 text-center fade-in max-w-lg mx-auto">
      <div className="inline-flex rounded-full bg-[var(--status-critical-soft)] p-3 mb-3">
        <ShieldAlert size={24} className="text-[var(--status-critical)]" />
      </div>
      <h2 className="text-base font-semibold text-[var(--text-primary)]">You don&apos;t have access to this page</h2>
      <p className="text-sm text-[var(--text-secondary)] mt-1">Your role doesn&apos;t include this area. If you think it should, ask your administrator.</p>
      <Link href="/dashboard" className="inline-block mt-4 text-sm font-medium text-[var(--accent-strong)] hover:underline">
        Back to the dashboard
      </Link>
    </div>
  );
}
