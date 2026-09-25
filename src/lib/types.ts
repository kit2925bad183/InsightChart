// Core data model shared across the app.

export type CellValue = string | number | boolean | null;

export interface DataSheet {
  id: string;
  name: string;
  headers: string[];
  rows: Record<string, CellValue>[];
}

export type SourceKind = "xlsx" | "csv" | "pdf" | "docx" | "txt" | "image" | "mock";

export interface ParsedSource {
  kind: SourceKind;
  fileName: string;
  sheets: DataSheet[];
  warnings: string[];
  /** Raw extracted text, kept for txt/pdf/image fallbacks and the NL box. */
  rawText?: string;
}

export type ColumnRole =
  | "name"
  | "registration"
  | "department"
  | "subject"
  | "score"
  | "date"
  | "status"
  | "numeric"
  | "category"
  | "unknown";

export interface ColumnProfile {
  key: string;
  role: ColumnRole;
  /** true if every non-empty value parses as a finite number */
  isNumeric: boolean;
  isDate: boolean;
  distinctCount: number;
  sampleValues: CellValue[];
  min?: number;
  max?: number;
  /** heuristic confidence 0-1 that this is "the" score column */
  scoreConfidence?: number;
}

export interface ColumnMapping {
  category?: string; // X axis
  numeric?: string; // Y axis / score column
  studentName?: string;
  registration?: string;
  department?: string;
  subject?: string;
  dateColumn?: string;
  scoreMin?: number;
  scoreMax?: number;
}

export type ChartType =
  | "bar"
  | "grouped-bar"
  | "stacked-bar"
  | "pie"
  | "donut"
  | "line"
  | "area"
  | "scatter"
  | "histogram"
  | "heatmap"
  | "flow"
  | "table";

export interface ScoreBand {
  id: string;
  label: string;
  min: number;
  max: number;
  tier: "support" | "developing" | "strong";
}

export interface AppState {
  /** Bumped on every LOAD_SOURCE / RESET — components key off this to reset their own
   * per-dataset local state (selected tabs, search, NL results) when a new file loads. */
  loadNonce: number;
  status: "empty" | "loading" | "error" | "ready";
  errorMessage?: string;
  source: ParsedSource | null;
  activeSheetId: string | null;
  columns: ColumnProfile[];
  mapping: ColumnMapping;
  chartType: ChartType;
  scoreBands: ScoreBand[];
  thresholdSupport: number;
  thresholdStrong: number;
  activeDepartments: string[]; // selected for filter/compare
  compareMode: boolean;
  search: string;
  sortKey: string | null;
  sortDir: "asc" | "desc";
  chartTitle: string;
  chartColorTheme: "default";
  chartAccentIndex: number;
  normalizeDepartments: boolean;
  /** raw department value -> canonical code, user-corrected overrides of the heuristic */
  departmentOverrides: Record<string, string>;
  nlHistory: { query: string; resultSummary: string }[];
  /** A one-off informational message (e.g. local data migrated to the server) — dismissible. */
  notice: string | null;
  /** False until the shared dataset has been fetched from the server once. */
  bootstrapped: boolean;
  /** Server version of the shared dataset; null while showing built-in sample data. */
  datasetVersion: number | null;
  /** Who last changed the shared dataset, and when (display only). */
  datasetUpdatedBy: string | null;
  datasetUpdatedAt: number | null;
  /** A newly uploaded file that still has to be saved to the server. */
  dirtySource: boolean;
  sync: "idle" | "saving" | "saved" | "error";
  syncError?: string;
}
