import type { ScoreBand } from "../types";
import { bandForScore } from "./scoreBands";
import { mean, round1, type StudentRecord } from "./stats";

export interface Insight {
  id: string;
  label: string;
  value: string;
  detail?: string;
}

export function buildInsights(
  records: StudentRecord[],
  bands: ScoreBand[],
  supportThreshold: number
): Insight[] {
  if (!records.length) return [];

  const insights: Insight[] = [];

  const byDept = new Map<string, number[]>();
  for (const r of records) {
    if (!byDept.has(r.department)) byDept.set(r.department, []);
    byDept.get(r.department)!.push(r.score);
  }
  if (byDept.size > 1) {
    const ranked = Array.from(byDept.entries())
      .map(([dept, scores]) => ({ dept, avg: mean(scores) }))
      .sort((a, b) => b.avg - a.avg);
    insights.push({
      id: "top-dept",
      label: "Highest-performing department",
      value: ranked[0].dept,
      detail: `Average score ${round1(ranked[0].avg)}`,
    });
  }

  const overallAvg = mean(records.map((r) => r.score));
  insights.push({ id: "avg", label: "Average score", value: `${round1(overallAvg)}` });

  const bandCounts = new Map<string, number>();
  for (const r of records) {
    const band = bandForScore(r.score, bands);
    if (!band) continue;
    bandCounts.set(band.label, (bandCounts.get(band.label) ?? 0) + 1);
  }
  const busiest = Array.from(bandCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  if (busiest) {
    insights.push({
      id: "busiest-band",
      label: "Score range with the most students",
      value: busiest[0],
      detail: `${busiest[1]} students`,
    });
  }

  const belowCount = records.filter((r) => r.score < supportThreshold).length;
  insights.push({
    id: "below-threshold",
    label: `Students below ${supportThreshold}`,
    value: String(belowCount),
    detail: `${round1((belowCount / records.length) * 100)}% of total`,
  });

  const top5 = [...records].sort((a, b) => b.score - a.score).slice(0, 5);
  insights.push({
    id: "top5",
    label: "Top five students",
    value: top5.map((r) => r.name).join(", "),
  });

  return insights;
}
