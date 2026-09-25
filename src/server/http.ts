import { NextResponse } from "next/server";
import { gunzipSync, gzipSync } from "node:zlib";
import { z, ZodError, type ZodType } from "zod";
import { getDb, isConnectionError } from "./db";
import { randomBytes } from "node:crypto";
import { SESSION_COOKIE, getSessionByToken, type SessionContext } from "./auth/sessions";
import { can, type Permission } from "@/lib/auth/permissions";
import { configuredSiteUrl } from "@/lib/siteUrl";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public extra?: Record<string, unknown>
  ) {
    super(message);
  }
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

/** Like json(), but gzips large bodies for clients that accept it — keeps big dataset
 * downloads under hosting response limits (Vercel: 4.5 MB) and makes them much faster. */
export function jsonCompressed(req: Request, data: unknown) {
  const body = JSON.stringify(data);
  const accepts = /\bgzip\b/.test(req.headers.get("accept-encoding") ?? "");
  if (!accepts || body.length < 64 * 1024) return json(data);
  return new Response(new Uint8Array(gzipSync(body)), {
    headers: { "Content-Type": "application/json", "Content-Encoding": "gzip", "Cache-Control": "no-store", Vary: "Accept-Encoding" },
  });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler: known errors become JSON { error, code }, anything else is
 * logged server-side and returned as a generic 500 without internals. */
export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return json({ error: err.message, code: err.code, ...err.extra }, { status: err.status });
      }
      if (err instanceof ZodError) {
        const first = err.issues[0];
        const where = first?.path.length ? `${first.path.join(".")}: ` : "";
        return json({ error: `${where}${first?.message ?? "Invalid request."}`, code: "invalid_request" }, { status: 400 });
      }
      // A short reference ties what the person sees to this log line, so a report like
      // "Ref K7Q2M9" leads straight to the cause.
      const ref = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
      console.error(`[insightchart] Unhandled API error (ref ${ref}) ${req.method} ${new URL(req.url).pathname}:`, err);
      const busy = isConnectionError(err);
      return json(
        {
          error: busy
            ? `The database is temporarily unreachable. Please try again in a moment. (Ref: ${ref})`
            : `Something went wrong on the server. Please try again. (Ref: ${ref})`,
          code: busy ? "database_unavailable" : "server_error",
          ref,
        },
        { status: busy ? 503 : 500 }
      );
    }
  };
}

/** CSRF defence for cookie-authenticated mutations: browsers always send Origin on
 * cross-site POST/PUT/PATCH/DELETE, so a mismatch with our own host is rejected. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "Cross-site request blocked.", "bad_origin");
  }
  if (!host || originHost !== host) throw new ApiError(403, "Cross-site request blocked.", "bad_origin");
}

const MAX_JSON_BYTES = 25 * 1024 * 1024;
/** Header the browser sets when it gzipped a large JSON body (see src/lib/api.ts). Hosting
 * platforms cap request bodies (Vercel: 4.5 MB), and a big mark sheet is several MB of JSON. */
export const BODY_ENCODING_HEADER = "x-body-encoding";

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) throw new ApiError(415, "Expected a JSON request body.", "unsupported_media_type");
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_JSON_BYTES) throw new ApiError(413, "Request is too large.", "too_large");
  let text: string;
  if (req.headers.get(BODY_ENCODING_HEADER) === "gzip") {
    try {
      // maxOutputLength stops a tiny "zip bomb" from expanding into gigabytes.
      text = gunzipSync(Buffer.from(await req.arrayBuffer()), { maxOutputLength: MAX_JSON_BYTES }).toString("utf8");
    } catch (err) {
      if ((err as { code?: string }).code === "ERR_BUFFER_TOO_LARGE") throw new ApiError(413, "Request is too large.", "too_large");
      throw new ApiError(400, "Request body could not be decompressed.", "invalid_body");
    }
  } else {
    text = await req.text();
  }
  if (text.length > MAX_JSON_BYTES) throw new ApiError(413, "Request is too large.", "too_large");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError(400, "Request body is not valid JSON.", "invalid_json");
  }
  return schema.parse(body);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

export async function sessionFromRequest(req: Request): Promise<SessionContext | null> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  return getSessionByToken(await getDb(), token);
}

/** The authorisation gate every protected API route goes through. */
export async function requireAuth(req: Request, permission?: Permission, opts: { allowPending?: boolean } = {}): Promise<SessionContext> {
  const ctx = await sessionFromRequest(req);
  if (!ctx) throw new ApiError(401, "Please sign in to continue.", "unauthenticated");
  if (ctx.session.stage === "pending" && !opts.allowPending) {
    throw new ApiError(403, "Finish setting up your account first.", "first_login_required");
  }
  if (permission && !can(ctx.user.role, permission)) {
    throw new ApiError(403, "Your role does not allow this action.", "forbidden");
  }
  return ctx;
}

export const zEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ message: "Enter a valid email address." }));

export const zOtp = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code from the email.");

/** Public address of the app for links in emails: APP_URL, else Vercel's production
 * domain, and only as a last resort (local development) the address this request used. */
export function appUrl(req: Request): string {
  return configuredSiteUrl() ?? new URL(req.url).origin;
}
