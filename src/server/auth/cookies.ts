import type { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "./sessions";
import type { RequestMeta } from "./service";
import { clientIp } from "../http";

export function setSessionCookie(res: NextResponse, token: string, expiresAt: number) {
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return res;
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), expires: new Date(0) });
  return res;
}

export function requestMeta(req: Request): RequestMeta {
  return { ip: clientIp(req), userAgent: req.headers.get("user-agent") ?? undefined };
}
