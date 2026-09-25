"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import type { AppState, ChartType, ColumnMapping, ParsedSource, ScoreBand } from "@/lib/types";
import { inferColumns, detectMapping } from "@/lib/analysis/inferColumns";
import { DEFAULT_BANDS } from "@/lib/analysis/scoreBands";
import { buildMockSource } from "@/lib/mockData";
import { loadSession, saveSession, type PersistedSession } from "@/lib/persistence";
import type { WorkspaceConfig } from "@/lib/workspace";
import { toStudentRecords } from "@/lib/analysis/stats";

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
  | { type: "SET_DEPARTMENT_OVERRIDE"; raw: string; code: string | null }
  | { type: "ADD_NL_HISTORY"; query: string; resultSummary: string }
  | { type: "HYDRATE"; session: PersistedSession }
  | { type: "LOAD_WORKSPACE"; config: WorkspaceConfig }
  | { type: "DISMISS_RESTORED_NOTICE" }
  | { type: "RESET" };

function freshFromSource(source: ParsedSource, prevNonce = 0): AppState {
  const activeSheet = source.sheets[0];
  const columns = activeSheet ? inferColumns(activeSheet) : [];
  const mapping = activeSheet ? detectMapping(activeSheet, columns) : {};
  return {
    loadNonce: prevNonce + 1,
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
    departmentOverrides: {},
    nlHistory: [],
    restoredNotice: false,
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
      return freshFromSource(action.source, state.loadNonce);
    case "SET_ACTIVE_SHEET": {
      const sheet = state.source?.sheets.find((s) => s.id === action.id);
      if (!sheet) return state;
      const columns = inferColumns(sheet);
      const mapping = detectMapping(sheet, columns);
      return { ...state, loadNonce: state.loadNonce + 1, activeSheetId: action.id, columns, mapping };
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
    case "SET_DEPARTMENT_OVERRIDE": {
      const next = { ...state.departmentOverrides };
      if (action.code === null) delete next[action.raw];
      else next[action.raw] = action.code;
      return { ...state, departmentOverrides: next };
    }
    case "ADD_NL_HISTORY":
      return { ...state, nlHistory: [{ query: action.query, resultSummary: action.resultSummary }, ...state.nlHistory].slice(0, 10) };
    case "HYDRATE": {
      const s = action.session;
      const base = freshFromSource(s.source, state.loadNonce);
      return {
        ...base,
        activeSheetId: s.activeSheetId ?? base.activeSheetId,
        mapping: s.mapping,
        chartType: s.chartType,
        scoreBands: s.scoreBands,
        thresholdSupport: s.thresholdSupport,
        thresholdStrong: s.thresholdStrong,
        chartTitle: s.chartTitle,
        chartAccentIndex: s.chartAccentIndex,
        normalizeDepartments: s.normalizeDepartments,
        departmentOverrides: s.departmentOverrides ?? {},
        restoredNotice: true,
      };
    }
    case "DISMISS_RESTORED_NOTICE":
      return { ...state, restoredNotice: false };
    case "LOAD_WORKSPACE": {
      const c = action.config;
      return {
        ...state,
        mapping: c.mapping,
        chartType: c.chartType,
        scoreBands: c.scoreBands,
        thresholdSupport: c.thresholdSupport,
        thresholdStrong: c.thresholdStrong,
        chartTitle: c.chartTitle,
        chartAccentIndex: c.chartAccentIndex,
        normalizeDepartments: c.normalizeDepartments,
        departmentOverrides: c.departmentOverrides ?? {},
      };
    }
    case "RESET":
      return freshFromSource(buildMockSource(), state.loadNonce);
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
  const hydratedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore the last uploaded session (if any) once on mount, after the fast
  // mock-data first paint — a refresh shouldn't silently discard someone's file.
  useEffect(() => {
    let cancelled = false;
    loadSession().then((session) => {
      if (!cancelled && session && !hydratedRef.current) {
        hydratedRef.current = true;
        dispatch({ type: "HYDRATE", session });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced autosave whenever there's a real (non-mock) dataset loaded.
  useEffect(() => {
    if (!state.source || state.source.kind === "mock") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveSession({
        source: state.source!,
        activeSheetId: state.activeSheetId,
        mapping: state.mapping,
        chartType: state.chartType,
        scoreBands: state.scoreBands,
        thresholdSupport: state.thresholdSupport,
        thresholdStrong: state.thresholdStrong,
        chartTitle: state.chartTitle,
        chartAccentIndex: state.chartAccentIndex,
        normalizeDepartments: state.normalizeDepartments,
        departmentOverrides: state.departmentOverrides,
        savedAt: Date.now(),
      });
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    state.source,
    state.activeSheetId,
    state.mapping,
    state.chartType,
    state.scoreBands,
    state.thresholdSupport,
    state.thresholdStrong,
    state.chartTitle,
    state.chartAccentIndex,
    state.normalizeDepartments,
    state.departmentOverrides,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  const activeSheet = pickSheet(ctx.state);
  const setMapping = useCallback((mapping: Partial<ColumnMapping>) => ctx.dispatch({ type: "SET_MAPPING", mapping }), [ctx]);
  return { ...ctx, activeSheet, setMapping };
}

/** Shared `StudentRecord[]` derivation — every routed page needs this, so it lives here
 * once instead of each page re-deriving it (this used to be a local useMemo inside the
 * single-page DashboardShell). */
export function useRecords() {
  const { state, activeSheet } = useApp();
  return useMemo(
    () =>
      activeSheet
        ? toStudentRecords(
            activeSheet,
            {
              studentName: state.mapping.studentName,
              registration: state.mapping.registration,
              department: state.mapping.department,
              numeric: state.mapping.numeric,
            },
            state.normalizeDepartments,
            state.departmentOverrides
          )
        : [],
    [
      activeSheet,
      state.mapping.studentName,
      state.mapping.registration,
      state.mapping.department,
      state.mapping.numeric,
      state.normalizeDepartments,
      state.departmentOverrides,
    ]
  );
}
