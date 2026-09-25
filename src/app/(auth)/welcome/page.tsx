import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = { title: "Welcome — InsightChart" };

/** First screen a signed-out visitor sees: the KIT splash. Clicking (or pressing Enter)
 * anywhere continues to the sign-in page, keeping any page they were headed to. */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const href = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <Link
      href={href}
      aria-label="Continue to sign in"
      className="group relative flex min-h-dvh flex-1 flex-col items-center justify-end bg-[#f4f4f5] bg-cover max-sm:bg-[length:185%_auto] bg-center bg-no-repeat pb-[8vh] focus-visible:outline-none"
      style={{ backgroundImage: "url('/images/kit-welcome.jpg')" }}
    >
      <span className="fade-in flex flex-col items-center gap-3">
        <span className="rounded-full bg-[#c8102e] px-6 py-3 text-sm font-semibold text-white shadow-lg transition-transform group-hover:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-[#c8102e]/40 inline-flex items-center gap-2">
          Continue to sign in <ArrowRight size={16} />
        </span>
        <span className="rounded-full bg-white/85 px-3 py-1 text-[11px] font-medium text-[#3d5372] backdrop-blur-sm">
          InsightChart · Click anywhere to continue
        </span>
      </span>
    </Link>
  );
}
