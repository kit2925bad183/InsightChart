import { describe, expect, it, vi } from "vitest";
import { route } from "../http";
import { isConnectionError } from "../db";

const req = () => new Request("http://localhost:3000/api/x", { method: "GET", headers: { host: "localhost:3000" } });

describe("unexpected server errors", () => {
  it("answer with a reference that also appears in the server log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await route(async () => {
      throw new Error("boom");
    })(req(), undefined);
    const body = (await res.json()) as { error: string; code: string; ref: string };
    expect(res.status).toBe(500);
    expect(body.code).toBe("server_error");
    expect(body.ref).toMatch(/^[0-9A-F]{6}$/);
    expect(body.error).toContain(`(Ref: ${body.ref})`);
    expect(String(log.mock.calls[0][0])).toContain(`ref ${body.ref}`);
    log.mockRestore();
  });

  it("explain a lost database connection as temporary", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await route(async () => {
      throw Object.assign(new Error("write CONNECTION_CLOSED"), { code: "CONNECTION_CLOSED" });
    })(req(), undefined);
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toMatch(/temporarily unreachable/);
    log.mockRestore();
  });

  it("tell connection failures apart from real SQL errors", () => {
    expect(["CONNECTION_CLOSED", "ECONNRESET", "08006", "57P01"].every((code) => isConnectionError({ code }))).toBe(true);
    expect(["23505", "42P01", undefined].some((code) => isConnectionError({ code }))).toBe(false);
  });
});
