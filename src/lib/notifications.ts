"use client";

import { useApp, useRecords } from "@/context/AppContext";
import { computeBasicAlerts } from "./analysis/alerts";

/** Powers the sidebar/topbar notification badges. `tasksDueCount` is a placeholder
 * until the real Tasks store lands in Phase 2 — kept as its own field now so nothing
 * downstream needs to change shape later. */
export function useNotificationCounts() {
  const { state } = useApp();
  const records = useRecords();
  const alertsCount = computeBasicAlerts(records, state.thresholdSupport).length;
  const tasksDueCount = 0;
  return { alertsCount, tasksDueCount, total: alertsCount + tasksDueCount };
}
