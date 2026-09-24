// Lightweight IndexedDB wrapper — no external dependency. Persists the last
// non-mock session (source data + mapping + settings) so a page refresh doesn't
// silently discard the user's uploaded file. Everything stays in the browser;
// nothing here ever leaves the device.

import type { ChartType, ColumnMapping, ParsedSource, ScoreBand } from "./types";

const DB_NAME = "insightchart";
const STORE = "session";
const KEY = "last-session";
const DB_VERSION = 1;

export interface PersistedSession {
  source: ParsedSource;
  activeSheetId: string | null;
  mapping: ColumnMapping;
  chartType: ChartType;
  scoreBands: ScoreBand[];
  thresholdSupport: number;
  thresholdStrong: number;
  chartTitle: string;
  chartAccentIndex: number;
  normalizeDepartments: boolean;
  departmentOverrides: Record<string, string>;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function saveSession(session: PersistedSession): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(session, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

export async function loadSession(): Promise<PersistedSession | null> {
  const db = await openDb();
  if (!db) return null;
  const result = await new Promise<PersistedSession | null>((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve((req.result as PersistedSession) ?? null);
    req.onerror = () => resolve(null);
  });
  db.close();
  return result;
}

export async function clearSession(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}
