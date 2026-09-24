"use client";

import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import type { AppState, ChartType, ColumnMapping, ParsedSource, ScoreBand } from "@/lib/types";
import { inferColumns, detectMapping } from "@/lib/analysis/inferColumns";
import { DEFAULT_BANDS } from "@/lib/analysis/scoreBands";
import { buildMockSource } from "@/lib/mockData";

type Action =
  | { type: "LOAD_SOURCE"; source: ParsedSource }
  | { type: "LOADING" }
  | { type: "ERROR"; message: string }
  | { type: "SET_ACTIVE_SHEET"; id: string }
  | { type: "SET_MAPPING"; mapping: Partial<ColumnMapping> }
  | { type: "SET_CHART_TYPE"; chartType: ChartType }
  | { type: "SET_BANDS"; bands: ScoreBand[] }
  | { type: "SET_THRESHOLDS"; support: number; strong: number }
  | { type: "SET_ACTIVE_DEPARTMENTS"; departments: string[] }
  | { type: "TOGGLE_COMPARE" }
  | { type: "SET_SEARCH"; search: string }
  | { type: "SET_SORT"; key: string | null; dir: "asc" | "desc" }
  | { type: "SET_CHART_TITLE"; title: string }
  | { type: "SET_ACCENT"; index: number }
  | { type: "TOGGLE_NORMALIZE_DEPARTMENTS" }
  | { type: "ADD_NL_HISTORY"; query: string; resultSummary: string }
  | { type: "RESET" };

function freshFromSource(source: ParsedSource): AppState {
  const activeSheet = source.sheets[0];
  const columns = activeSheet ? inferColumns(activeSheet) : [];
  const mapping = activeSheet ? detectMapping(activeSheet, columns) : {};
  return {
    status: source.sheets.length ? "ready" : "error",
    errorMessage: source.sheets.length ? undefined : (source.warnings[0] ?? "No data found."),
    source,
    activeSheetId: activeSheet?.id ?? null,
    columns,
    mapping,
    chartType: "bar",
    scoreBands: DEFAULT_BANDS,
    thresholdSupport: 35,
    thresholdStrong: 60,
    activeDepartments: [],
    compareMode: false,
    search: "",
    sortKey: null,
    sortDir: "asc",
    chartTitle: "Score Distribution",
    chartColorTheme: "default",
    chartAccentIndex: 0,
    normalizeDepartments: true,
    nlHistory: [],
  };
}

function initialState(): AppState {
  return freshFromSource(buildMockSource());
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "LOADING":
      return { ...state, status: "loading", errorMessage: undefined };
    case "ERROR":
      return { ...state, status: "error", errorMessage: action.message };
    case "LOAD_SOURCE":
      return freshFromSource(action.source);
    case "SET_ACTIVE_SHEET": {
      const sheet = state.source?.sheets.find((s) => s.id === action.id);
      if (!sheet) return state;
      const columns = inferColumns(sheet);
      const mapping = detectMapping(sheet, columns);
      return { ...state, activeSheetId: action.id, columns, mapping };
    }
    case "SET_MAPPING":
      return { ...state, mapping: { ...state.mapping, ...action.mapping } };
    case "SET_CHART_TYPE":
      return { ...state, chartType: action.chartType };
    case "SET_BANDS":
      return { ...state, scoreBands: action.bands };
    case "SET_THRESHOLDS":
      return { ...state, thresholdSupport: action.support, thresholdStrong: action.strong };
    case "SET_ACTIVE_DEPARTMENTS":
      return { ...state, activeDepartments: action.departments };
    case "TOGGLE_COMPARE":
      return { ...state, compareMode: !state.compareMode };
    case "SET_SEARCH":
      return { ...state, search: action.search };
    case "SET_SORT":
      return { ...state, sortKey: action.key, sortDir: action.dir };
    case "SET_CHART_TITLE":
      return { ...state, chartTitle: action.title };
    case "SET_ACCENT":
      return { ...state, chartAccentIndex: action.index };
    case "TOGGLE_NORMALIZE_DEPARTMENTS":
      return { ...state, normalizeDepartments: !state.normalizeDepartments };
    case "ADD_NL_HISTORY":
      return { ...state, nlHistory: [{ query: action.query, resultSummary: action.resultSummary }, ...state.nlHistory].slice(0, 10) };
    case "RESET":
      return freshFromSource(buildMockSource());
    default:
      return state;
  }
}

function pickSheet(state: AppState) {
  return state.source?.sheets.find((s) => s.id === state.activeSheetId) ?? state.source?.sheets[0] ?? null;
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  const activeSheet = pickSheet(ctx.state);
  const setMapping = useCallback((mapping: Partial<ColumnMapping>) => ctx.dispatch({ type: "SET_MAPPING", mapping }), [ctx]);
  return { ...ctx, activeSheet, setMapping };
}
