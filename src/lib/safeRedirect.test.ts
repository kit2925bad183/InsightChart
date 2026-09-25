import { describe, expect, it } from "vitest";
import { safeRedirect } from "./safeRedirect";

describe("safeRedirect", () => {
  it("keeps paths on this site, with their query and hash", () => {
    expect(safeRedirect("/students")).toBe("/students");
    expect(safeRedirect("/student-performance?student=21CS001&by=day#chart")).toBe("/student-performance?student=21CS001&by=day#chart");
  });

  it("refuses anything that leaves the site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "/\t/evil.com", "/\n/evil.com", "/\r\n//evil.com", "javascript:alert(1)", "", undefined, null]) {
      expect(safeRedirect(bad as string)).toBe("/dashboard");
    }
  });

  it("doesn't send you back into the sign-in pages", () => {
    expect(safeRedirect("/login?next=/x")).toBe("/dashboard");
    expect(safeRedirect("/welcome")).toBe("/dashboard");
  });
});
