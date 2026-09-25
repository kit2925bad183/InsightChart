"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import type { AppState, ChartType, ColumnMapping, ParsedSource, ScoreBand } from "@/lib/types";
import { inferColumns, detectMapping } from "@/lib/analysis/inferColumns";
import { DEFAULT_BANDS } from "@/lib/analysis/scoreBands";
import { buildMockSource } from "@/lib/mockData";
import { clearSession, loadSession } from "@/lib/persistence";
import type { WorkspaceConfig } from "@/lib/workspace";
import { toStudentRecords } from "@/lib/analysis/stats";
import { applyRowOp, type DatasetConfig, type DatasetPayload, type RowOp } from "@/lib/datasetEdits";
import { api, ApiRequestError } from "@/lib/api";
import { useSession } from "@/lib/auth/session";

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
  | { type: "SERVER_LOADED"; dataset: DatasetPayload | null; notice?: string }
  | { type: "LOAD_FAILED"; message: string }
  | { type: "SOURCE_SAVED"; version: number }
  | { type: "ROW_OP_SAVED"; op: RowOp; version: number }
  | { type: "SYNC"; sync: AppState["sync"]; error?: string }
  | { type: "LOAD_WORKSPACE"; config: WorkspaceConfig }
  | { type: "DISMISS_NOTICE" }
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
    notice: null,
    bootstrapped: true,
    datasetVersion: null,
    datasetUpdatedBy: null,
    datasetUpdatedAt: null,
    dirtySource: false,
    sync: "idle",
  };
}

/** Before the shared dataset arrives from the server — pages show a loading state. */
function initialState(): AppState {
  return { ...freshFromSource({ kind: "mock", fileName: "", sheets: [], warnings: [] }), status: "loading", source: null, bootstrapped: false };
}

function withConfig(state: AppState, c: DatasetConfig | WorkspaceConfig): AppState {
  const sheet = "activeSheetId" in c && c.activeSheetId ? state.source?.sheets.find((s) => s.id === c.activeSheetId) : null;
  const columns = sheet ? inferColumns(sheet) : state.columns;
  return {
    ...state,
    activeSheetId: sheet ? sheet.id : state.activeSheetId,
    columns,
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

export function configOf(state: AppState): DatasetConfig {
  return {
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
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "LOADING":
      return { ...state, status: "loading", errorMessage: undefined };
    case "ERROR":
      return { ...state, status: "error", errorMessage: action.message };
    case "LOAD_SOURCE": {
      const next = freshFromSource(action.source, state.loadNonce);
      return { ...next, datasetVersion: state.datasetVersion, dirtySource: next.status === "ready" && action.source.kind !== "mock" };
    }
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
    case "SERVER_LOADED": {
      // Never let a (re)load clobber a newly uploaded file that's still being saved.
      if (state.dirtySource) return { ...state, bootstrapped: true };
      if (!action.dataset) {
        return { ...freshFromSource(buildMockSource(), state.loadNonce), notice: action.notice ?? null };
      }
      const d = action.dataset;
      const base = freshFromSource(d.source, state.loadNonce);
      return {
        ...withConfig(base, d.config),
        datasetVersion: d.version,
        datasetUpdatedBy: d.updatedByName,
        datasetUpdatedAt: d.updatedAt,
        notice: action.notice ?? null,
      };
    }
    case "LOAD_FAILED":
      return { ...state, bootstrapped: true, status: "error", errorMessage: action.message, source: null };
    case "SOURCE_SAVED":
      return { ...state, datasetVersion: action.version, dirtySource: false, datasetUpdatedAt: Date.now() };
    case "ROW_OP_SAVED": {
      if (!state.source) return state;
      const source = applyRowOp(state.source, action.op);
      // Keep columns/mapping as they are — an edit shouldn't reshuffle the user's setup.
      return { ...state, source, datasetVersion: action.version, datasetUpdatedAt: Date.now() };
    }
    case "SYNC":
      return { ...state, sync: action.sync, syncError: action.error };
    case "DISMISS_NOTICE":
      return { ...state, notice: null };
    case "LOAD_WORKSPACE":
      return withConfig(state, action.config);
    case "RESET":
      return { ...freshFromSource(buildMockSource(), state.loadNonce), datasetVersion: null };
    default:
      return state;
  }
}

function pickSheet(state: AppState) {
  return state.source?.sheets.find((s) => s.id === state.activeSheetId) ?? state.source?.sheets[0] ?? null;
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  /** Whether this user's changes are saved to the shared dataset (editors only). */
  canEdit: boolean;
  /** Add/edit/delete one record on the server, then mirror it locally. */
  saveRowOp: (op: RowOp) => Promise<void>;
  /** Clear the shared dataset (back to sample data) on the server. */
  resetDataset: () => Promise<void>;
  /** Re-fetch the shared dataset, discarding local unsaved view changes. */
  reloadDataset: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const MIGRATED_NOTICE = "Your dataset saved in this browser before sign-in existed has been moved to the server, so every signed-in colleague now sees it.";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { can } = useSession();
  const canEdit = can("records:edit");
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  const savedConfigJson = useRef<string | null>(null);
  const configTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFromServer = useCallback(async () => {
    const { dataset } = await api<{ dataset: DatasetPayload | null }>("/api/dataset");
    if (dataset) {
      savedConfigJson.current = JSON.stringify(dataset.config);
      dispatch({ type: "SERVER_LOADED", dataset });
      return;
    }
    // One-time migration: before accounts existed, an uploaded dataset lived only in this
    // browser's IndexedDB. The first editor to sign in here publishes it to the server.
    if (canEdit) {
      const local = await loadSession().catch(() => null);
      if (local && local.source.kind !== "mock") {
        const config: DatasetConfig = {
          activeSheetId: local.activeSheetId,
          mapping: local.mapping,
          chartType: local.chartType,
          scoreBands: local.scoreBands,
          thresholdSupport: local.thresholdSupport,
          thresholdStrong: local.thresholdStrong,
          chartTitle: local.chartTitle,
          chartAccentIndex: local.chartAccentIndex,
          normalizeDepartments: local.normalizeDepartments,
          departmentOverrides: local.departmentOverrides ?? {},
        };
        try {
          const { version } = await api<{ version: number }>("/api/dataset", { method: "PUT", body: { source: local.source, config } });
          await clearSession();
          savedConfigJson.current = JSON.stringify(config);
          dispatch({
            type: "SERVER_LOADED",
            dataset: { source: local.source, config, version, updatedAt: Date.now(), updatedByName: null },
            notice: MIGRATED_NOTICE,
          });
          return;
        } catch {
          // Keep the local copy untouched and fall back to sample data; the editor can re-upload.
        }
      }
    }
    savedConfigJson.current = null;
    dispatch({ type: "SERVER_LOADED", dataset: null });
  }, [canEdit]);

  useEffect(() => {
    loadFromServer().catch((err) => {
      dispatch({ type: "LOAD_FAILED", message: err instanceof ApiRequestError ? err.message : "Couldn't load the shared dataset." });
    });
  }, [loadFromServer]);

  // A newly uploaded file (editors only — the upload control isn't shown to anyone else,
  // and the API rejects it regardless) is published to the server right away.
  useEffect(() => {
    if (!canEdit || !state.dirtySource || !state.source) return;
    const source = state.source;
    const config = configOf(state);
    let cancelled = false;
    dispatch({ type: "SYNC", sync: "saving" });
    api<{ version: number }>("/api/dataset", { method: "PUT", body: { source, config } })
      .then(({ version }) => {
        if (cancelled) return;
        savedConfigJson.current = JSON.stringify(config);
        dispatch({ type: "SOURCE_SAVED", version });
        dispatch({ type: "SYNC", sync: "saved" });
      })
      .catch((err) => {
        if (!cancelled) dispatch({ type: "SYNC", sync: "error", error: err instanceof Error ? err.message : "Save failed." });
      });
    return () => {
      cancelled = true;
    };
    // Only a new source should trigger this; config edits are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, state.dirtySource, state.source]);

  // Debounced save of mapping/bands/thresholds/department corrections for editors.
  const { activeSheetId, mapping, chartType, scoreBands, thresholdSupport, thresholdStrong, chartTitle, chartAccentIndex, normalizeDepartments, departmentOverrides } = state;
  const config = useMemo<DatasetConfig>(
    () => ({ activeSheetId, mapping, chartType, scoreBands, thresholdSupport, thresholdStrong, chartTitle, chartAccentIndex, normalizeDepartments, departmentOverrides }),
    [activeSheetId, mapping, chartType, scoreBands, thresholdSupport, thresholdStrong, chartTitle, chartAccentIndex, normalizeDepartments, departmentOverrides]
  );
  useEffect(() => {
    if (!canEdit || state.datasetVersion === null || state.dirtySource) return;
    const json = JSON.stringify(config);
    if (json === savedConfigJson.current) return;
    if (configTimer.current) clearTimeout(configTimer.current);
    configTimer.current = setTimeout(() => {
      dispatch({ type: "SYNC", sync: "saving" });
      api("/api/dataset/config", { method: "PUT", body: { config } })
        .then(() => {
          savedConfigJson.current = json;
          dispatch({ type: "SYNC", sync: "saved" });
        })
        .catch((err) => dispatch({ type: "SYNC", sync: "error", error: err instanceof Error ? err.message : "Save failed." }));
    }, 800);
    return () => {
      if (configTimer.current) clearTimeout(configTimer.current);
    };
  }, [canEdit, config, state.datasetVersion, state.dirtySource]);

  const saveRowOp = useCallback(async (op: RowOp) => {
    const version = stateRef.current.datasetVersion;
    if (version === null) throw new ApiRequestError(400, "Upload a dataset before editing records — sample data can't be edited.");
    dispatch({ type: "SYNC", sync: "saving" });
    try {
      const res = await api<{ version: number }>("/api/dataset/rows", { method: "POST", body: { ...op, version } });
      dispatch({ type: "ROW_OP_SAVED", op, version: res.version });
      dispatch({ type: "SYNC", sync: "saved" });
    } catch (err) {
      dispatch({ type: "SYNC", sync: "error", error: err instanceof Error ? err.message : "Save failed." });
      throw err;
    }
  }, []);

  const resetDataset = useCallback(async () => {
    await api("/api/dataset", { method: "DELETE" });
    await clearSession().catch(() => {});
    savedConfigJson.current = null;
    dispatch({ type: "RESET" });
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, canEdit, saveRowOp, resetDataset, reloadDataset: loadFromServer }),
    [state, canEdit, saveRowOp, resetDataset, loadFromServer]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  const activeSheet = pickSheet(ctx.state);
  const { dispatch } = ctx;
  const setMapping = useCallback((mapping: Partial<ColumnMapping>) => dispatch({ type: "SET_MAPPING", mapping }), [dispatch]);
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
