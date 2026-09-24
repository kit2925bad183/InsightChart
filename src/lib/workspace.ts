import type { ChartType, ColumnMapping, ScoreBand } from "./types";

export interface WorkspaceConfig {
  formatVersion: 1;
  mapping: ColumnMapping;
  chartType: ChartType;
  scoreBands: ScoreBand[];
  thresholdSupport: number;
  thresholdStrong: number;
  chartTitle: string;
  chartAccentIndex: number;
  normalizeDepartments: boolean;
  departmentOverrides: Record<string, string>;
}

export function downloadWorkspace(config: Omit<WorkspaceConfig, "formatVersion">) {
  const payload: WorkspaceConfig = { formatVersion: 1, ...config };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "insightchart-workspace.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Best-effort validation — a hand-edited or older-format file shouldn't crash the app. */
export function parseWorkspaceFile(raw: string): WorkspaceConfig | null {
  try {
    const data = JSON.parse(raw);
    if (
      data &&
      typeof data === "object" &&
      typeof data.mapping === "object" &&
      typeof data.chartType === "string" &&
      Array.isArray(data.scoreBands) &&
      typeof data.thresholdSupport === "number" &&
      typeof data.thresholdStrong === "number"
    ) {
      return {
        formatVersion: 1,
        mapping: data.mapping,
        chartType: data.chartType,
        scoreBands: data.scoreBands,
        thresholdSupport: data.thresholdSupport,
        thresholdStrong: data.thresholdStrong,
        chartTitle: typeof data.chartTitle === "string" ? data.chartTitle : "Score Distribution",
        chartAccentIndex: typeof data.chartAccentIndex === "number" ? data.chartAccentIndex : 0,
        normalizeDepartments: typeof data.normalizeDepartments === "boolean" ? data.normalizeDepartments : true,
        departmentOverrides: data.departmentOverrides && typeof data.departmentOverrides === "object" ? data.departmentOverrides : {},
      };
    }
    return null;
  } catch {
    return null;
  }
}
