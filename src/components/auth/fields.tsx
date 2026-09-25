"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { clsx } from "clsx";

export function TextField({ label, hint, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className={clsx(
          "text-sm rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-60",
          className
        )}
      />
      {hint && <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

export function PasswordField({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          {...props}
          className="w-full text-sm rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] pl-3 pr-9 py-2 text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {hint && <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  if (!children) return null;
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={clsx(
        "flex gap-2 items-start rounded-lg px-3 py-2.5 text-xs",
        tone === "error" && "bg-[var(--status-critical-soft)] text-[var(--status-critical)]",
        tone === "success" && "bg-[var(--status-good-soft)] text-[var(--status-good)]",
        tone === "info" && "bg-[var(--accent-soft)] text-[var(--text-primary)]"
      )}
    >
      <Icon size={15} className="shrink-0 mt-px" />
      <div>{children}</div>
    </div>
  );
}

export const PASSWORD_RULES_HINT = "At least 10 characters, including a letter and a number.";
