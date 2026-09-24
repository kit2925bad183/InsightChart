import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "text-xs px-2.5 py-1.5" : "text-sm px-3.5 py-2",
        variant === "primary" && "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]",
        variant === "secondary" && "bg-[var(--surface-muted,#f2f6fc)] text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-strong)]",
        variant === "outline" && "bg-transparent text-[var(--text-primary)] border border-[var(--border-strong)] hover:bg-[var(--accent-soft)]",
        variant === "ghost" && "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]",
        className
      )}
      {...props}
    />
  );
}
