// Tiny JSON client for InsightChart's own API. Same-origin cookies carry the session.

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public data?: Record<string, unknown>
  ) {
    super(message);
  }
}

// Bodies above this are gzipped before sending: hosting platforms cap request size
// (Vercel: 4.5 MB) and an uploaded mark sheet can be several MB of JSON.
const COMPRESS_OVER_BYTES = 256 * 1024;

async function encodeBody(body: unknown): Promise<{ body: BodyInit; headers: Record<string, string> }> {
  const text = JSON.stringify(body);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (text.length < COMPRESS_OVER_BYTES || typeof CompressionStream === "undefined") return { body: text, headers };
  const gz = await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
  return { body: gz, headers: { ...headers, "X-Body-Encoding": "gzip" } };
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; redirectOn401?: boolean } = {}): Promise<T> {
  const { method = "GET", body, redirectOn401 = true } = opts;
  let res: Response;
  try {
    const encoded = body !== undefined ? await encodeBody(body) : undefined;
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: encoded?.headers,
      body: encoded?.body,
    });
  } catch {
    throw new ApiRequestError(0, "Can't reach the server. Check your connection and try again.", "network_error");
  }
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    // Non-JSON body (shouldn't happen for our API) — fall through with an empty object.
  }
  if (!res.ok) {
    if (res.status === 401 && redirectOn401 && typeof window !== "undefined") {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate full reload at a session boundary so no in-memory data from the previous session survives
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
    throw new ApiRequestError(res.status, (data.error as string) ?? `Request failed (${res.status}).`, data.code as string | undefined, data);
  }
  return data as T;
}

/** Downloads a file from an authenticated endpoint (the session cookie is sent along). */
export async function downloadFromApi(path: string, fallbackName: string) {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) {
    let message = `Download failed (${res.status}).`;
    try {
      message = ((await res.json()) as { error?: string }).error ?? message;
    } catch {}
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate full reload at a session boundary so no in-memory data from the previous session survives
    if (res.status === 401) window.location.assign("/login");
    throw new ApiRequestError(res.status, message);
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}
