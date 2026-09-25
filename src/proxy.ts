import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { SESSION_COOKIE, getSessionByToken } from "@/server/auth/sessions";
import { FIRST_LOGIN_PAGE, canAccessPage, isPublicPage, pagePermission } from "@/lib/auth/permissions";

// Page-level gate. Runs on the Node.js runtime (the Next 16 default for proxy), so it
// checks the real session in the database rather than trusting the cookie's presence.
// API routes are excluded by the matcher and enforce permissions themselves — this
// layer only decides which pages a browser may load.
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const ctx = token ? await getSessionByToken(await getDb(), token) : null;

  const redirect = (to: string) => {
    const res = NextResponse.redirect(new URL(to, req.url));
    if (token && !ctx) res.cookies.delete(SESSION_COOKIE);
    return res;
  };

  if (isPublicPage(pathname)) {
    if (ctx?.session.stage === "active") return redirect("/dashboard");
    return NextResponse.next();
  }

  if (pathname === FIRST_LOGIN_PAGE) {
    if (!ctx) return redirect("/login");
    // Also reachable later (from My Account) while still on the initial password.
    if (ctx.session.stage === "active" && !ctx.user.must_change_password) return redirect("/dashboard");
    return NextResponse.next();
  }

  if (!ctx) {
    // Signed-out visitors first see the KIT welcome screen, which continues to /login.
    const next = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return redirect(`/welcome${next}`);
  }
  if (ctx.session.stage === "pending") return redirect(FIRST_LOGIN_PAGE);
  if (pathname === "/") return NextResponse.next();

  if (!canAccessPage(ctx.user.role, pathname)) {
    // Known page the role may not open → 403; an address that isn't a page at all → 404.
    return NextResponse.rewrite(new URL("/forbidden", req.url), { status: pagePermission(pathname) ? 403 : 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except API routes, Next internals, and static files (anything with an extension).
    "/((?!api/|_next/static|_next/image|.*\\.[A-Za-z0-9]+$).*)",
  ],
};
