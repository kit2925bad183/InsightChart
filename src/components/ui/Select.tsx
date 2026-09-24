import { clsx } from "clsx";
import type { SelectHTMLAttributes } from "react";

export function Select({
  label,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const select = (
    <select
      className={clsx(
        // w-full + min-w-0 stop a <select> from sizing itself to its widest <option> text —
        // real-world files can have very long column headers (e.g. survey question text),
        // which otherwise blows out the layout since native selects size to content by default.
        "w-full min-w-0 max-w-full text-sm rounded-lg border border-[var(--border-strong)] bg-white px-2.5 py-1.5 text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
  if (!label) return select;
  return (
    <label className="flex flex-col gap-1 min-w-0 text-xs font-medium text-[var(--text-secondary)]">
      {label}
      {select}
    </label>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warning" | "critical" | "accent";
  children: React.ReactNode;
}) {
  const toneClass = {
    neutral: "bg-[var(--surface-muted,#f2f6fc)] text-[var(--text-secondary)]",
    good: "bg-[var(--status-good-soft)] text-[var(--status-good)]",
    warning: "bg-[var(--status-warning-soft)] text-[#8a5a00]",
    critical: "bg-[var(--status-critical-soft)] text-[var(--status-critical)]",
    accent: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
  }[tone];
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", toneClass)}>
      {children}
    </span>
  );
}
