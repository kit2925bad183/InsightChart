import type { DataSheet, ParsedSource } from "./types";

const DEPARTMENTS = ["CSE", "CSBS", "ECE", "IT", "MECH"];
const FIRST = ["Aarav", "Vihaan", "Diya", "Ananya", "Kabir", "Ishaan", "Myra", "Sai", "Riya", "Arjun", "Kiara", "Aditya", "Priya", "Rohan", "Sneha", "Dev", "Tara", "Nikhil", "Meera", "Yash"];
const LAST = ["Sharma", "Verma", "Iyer", "Nair", "Reddy", "Singh", "Menon", "Gupta", "Rao", "Pillai"];

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianAround(mean: number, spread: number, rng: () => number) {
  const u1 = rng() || 1e-6;
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * spread;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function buildMockSource(): ParsedSource {
  // Fresh generator per call so repeated invocations (e.g. React StrictMode's
  // double-invoked lazy initializer) stay deterministic instead of drifting.
  const rand = mulberry32(42);
  const rows: DataSheet["rows"] = [];
  const deptBias: Record<string, number> = { CSE: 68, CSBS: 63, ECE: 55, IT: 60, MECH: 48 };
  let idx = 0;
  for (const dept of DEPARTMENTS) {
    const count = 24 + Math.floor(rand() * 10);
    for (let i = 0; i < count; i++) {
      idx++;
      const first = FIRST[Math.floor(rand() * FIRST.length)];
      const last = LAST[Math.floor(rand() * LAST.length)];
      const base = deptBias[dept];
      const score = Math.round(clamp(gaussianAround(base, 16, rand), 2, 80));
      const aptitude = Math.round(clamp(gaussianAround(base - 3, 14, rand), 0, 40));
      const reasoning = Math.round(clamp(gaussianAround(base - 3, 14, rand), 0, 40));
      const day = 1 + Math.floor(rand() * 27);
      rows.push({
        "Student Name": `${first} ${last}`,
        "Registration No": `21${dept}${String(idx).padStart(4, "0")}`,
        Department: dept,
        Score: score,
        "Aptitude Score": aptitude,
        "Reasoning Score": reasoning,
        Date: `2026-03-${String(day).padStart(2, "0")}`,
        Status: score >= 50 ? "Qualified" : score >= 30 ? "Review" : "Not Qualified",
      });
    }
  }

  const headers = Object.keys(rows[0]);
  const sheet: DataSheet = { id: "sheet-1", name: "Mock Assessment", headers, rows };

  return {
    kind: "mock",
    fileName: "Sample Placement Mock Assessment.xlsx",
    sheets: [sheet],
    warnings: [],
  };
}
