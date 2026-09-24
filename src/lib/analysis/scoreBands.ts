import type { ScoreBand } from "../types";

export const DEFAULT_BANDS: ScoreBand[] = [
  { id: "b1", label: "0–10", min: 0, max: 10, tier: "support" },
  { id: "b2", label: "11–20", min: 11, max: 20, tier: "support" },
  { id: "b3", label: "21–30", min: 21, max: 30, tier: "support" },
  { id: "b4", label: "31–40", min: 31, max: 40, tier: "developing" },
  { id: "b5", label: "41–50", min: 41, max: 50, tier: "developing" },
  { id: "b6", label: "51–60", min: 51, max: 60, tier: "strong" },
  { id: "b7", label: "61–70", min: 61, max: 70, tier: "strong" },
  { id: "b8", label: "71–80", min: 71, max: 80, tier: "strong" },
];

export function bandForScore(score: number, bands: ScoreBand[]): ScoreBand | undefined {
  return bands.find((b) => score >= b.min && score <= b.max) ?? (score > bands[bands.length - 1].max
    ? bands[bands.length - 1]
    : bands[0]);
}

/** The score that first counts as "strong" and the score that last counts as "needs support", derived from the band tiers themselves. */
export function deriveTierThresholds(bands: ScoreBand[]) {
  const strongBands = bands.filter((b) => b.tier === "strong");
  const supportBands = bands.filter((b) => b.tier === "support");
  const strongMin = strongBands.length ? Math.min(...strongBands.map((b) => b.min)) : bands[bands.length - 1].min;
  const supportMax = supportBands.length ? Math.max(...supportBands.map((b) => b.max)) : bands[0].max;
  return { strongMin, supportMax };
}
