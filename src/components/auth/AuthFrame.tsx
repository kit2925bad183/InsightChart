import { clsx } from "clsx";
import { BarChart3 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

/** Page chrome for the signed-out screens. `branded` puts the KIT backdrop behind the page
 * (used on the sign-in page only) and turns the card into frosted glass pushed to the
 * right on wide screens, so the logo in the middle of the image stays visible. */
export function AuthFrame({ children, branded = false }: { children: React.ReactNode; branded?: boolean }) {
  return (
    <div
      className={clsx("min-h-dvh flex-1 flex flex-col", branded && "bg-cover bg-center bg-no-repeat bg-[#f7f4ec]")}
      style={branded ? { backgroundImage: "url('/images/kit-signin-bg-sage.jpg')" } : undefined}
    >
      <header className="flex items-center justify-between px-4 sm:px-6 h-[var(--topbar-height)]">
        <span className={clsx("flex items-center gap-2", branded && "rounded-xl px-2.5 py-1.5 bg-white/90 backdrop-blur-sm")}>
          <span className="rounded-lg bg-[var(--accent)] text-white p-1.5">
            <BarChart3 size={18} />
          </span>
          <span className={clsx("text-sm font-bold", branded ? "text-[#0b1f3a]" : "text-[var(--text-primary)]")}>InsightChart</span>
        </span>
        <span className={clsx(branded && "rounded-xl bg-white/90 backdrop-blur-sm")}>
          <ThemeToggle />
        </span>
      </header>
      <main className={clsx("flex-1 flex items-start sm:items-center justify-center px-4 py-8", branded && "xl:justify-end xl:pr-[5vw]")}>
        <div
          className={clsx("card w-full p-6 sm:p-8 fade-in", branded ? "max-w-sm backdrop-blur-md" : "max-w-md")}
          style={branded ? { background: "color-mix(in srgb, var(--surface) 86%, transparent)" } : undefined}
        >
          {children}
        </div>
      </main>
      <footer className="py-4 text-center">
        <span className={clsx("text-[11px]", branded ? "rounded-full px-3 py-1 bg-white/90 backdrop-blur-sm text-[#3d5372]" : "text-[var(--text-muted)]")}>
          Staff access only. Accounts are created by an Administrator.
        </span>
      </footer>
    </div>
  );
}
