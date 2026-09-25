import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <div className="card p-10 text-center fade-in max-w-lg mx-auto">
      <div className="inline-flex rounded-full bg-[var(--status-critical-soft)] p-3 mb-3">
        <ShieldAlert size={24} className="text-[var(--status-critical)]" />
      </div>
      <h2 className="text-base font-semibold text-[var(--text-primary)]">This page isn&apos;t available</h2>
      <p className="text-sm text-[var(--text-secondary)] mt-1">
        It doesn&apos;t exist, or your role doesn&apos;t include this area. Check the address, or ask your administrator if you think you should have access.
      </p>
      <Link href="/dashboard" className="inline-block mt-4 text-sm font-medium text-[var(--accent-strong)] hover:underline">
        Back to the dashboard
      </Link>
    </div>
  );
}
