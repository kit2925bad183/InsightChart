import type { StudentRecord } from "./stats";
import { mean, round1 } from "./stats";

export interface Alert {
  id: string;
  severity: "critical" | "warning";
  title: string;
  detail: string;
  href: string;
}

/** Phase 1 alert set: low scores + weak departments, the two rules computable from the
 * current dataset alone. Missing marks, duplicate records, upcoming deadlines, and
 * "no intervention yet" are added once Tasks/Interventions exist (see AlertRulesEngine). */
export function computeBasicAlerts(records: StudentRecord[], thresholdSupport: number): Alert[] {
  const alerts: Alert[] = [];
  if (!records.length) return alerts;

  const lowScorers = records.filter((r) => r.score < thresholdSupport);
  if (lowScorers.length) {
    alerts.push({
      id: "low-scores",
      severity: "critical",
      title: `${lowScorers.length} student${lowScorers.length === 1 ? "" : "s"} below ${thresholdSupport}`,
      detail: "These students may need immediate support.",
      href: "/students",
    });
  }

  const byDept = new Map<string, number[]>();
  for (const r of records) {
    if (!r.department || r.department === "—") continue;
    if (!byDept.has(r.department)) byDept.set(r.department, []);
    byDept.get(r.department)!.push(r.score);
  }
  for (const [dept, scores] of byDept) {
    const avg = mean(scores);
    if (avg < thresholdSupport) {
      alerts.push({
        id: `weak-dept-${dept}`,
        severity: "warning",
        title: `${dept} average is ${round1(avg)}`,
        detail: `Below the support threshold of ${thresholdSupport}.`,
        href: "/departments",
      });
    }
  }

  return alerts;
}
