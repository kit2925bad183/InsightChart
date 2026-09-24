import { describe, expect, it } from "vitest";
import { DEFAULT_BANDS, bandForScore, deriveTierThresholds } from "./scoreBands";

describe("bandForScore", () => {
  it("finds the exact band for a score within range", () => {
    expect(bandForScore(5, DEFAULT_BANDS)?.label).toBe("0–10");
    expect(bandForScore(35, DEFAULT_BANDS)?.label).toBe("31–40");
    expect(bandForScore(80, DEFAULT_BANDS)?.label).toBe("71–80");
  });

  it("clamps a score above every band into the last band", () => {
    expect(bandForScore(150, DEFAULT_BANDS)?.label).toBe("71–80");
  });

  it("handles boundary values correctly", () => {
    expect(bandForScore(10, DEFAULT_BANDS)?.label).toBe("0–10");
    expect(bandForScore(11, DEFAULT_BANDS)?.label).toBe("11–20");
  });
});

describe("deriveTierThresholds", () => {
  it("derives the strong-tier floor and support-tier ceiling from the default bands", () => {
    const { strongMin, supportMax } = deriveTierThresholds(DEFAULT_BANDS);
    expect(strongMin).toBe(51);
    expect(supportMax).toBe(30);
  });

  it("recomputes correctly after a band's tier is edited", () => {
    const edited = DEFAULT_BANDS.map((b) => (b.id === "b4" ? { ...b, tier: "support" as const } : b));
    const { supportMax } = deriveTierThresholds(edited);
    expect(supportMax).toBe(40); // 31–40 now counts as support too
  });
});
