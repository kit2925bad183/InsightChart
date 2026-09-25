"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { parseFile } from "@/lib/parsers";
import { inferColumns, detectMapping } from "@/lib/analysis/inferColumns";
import { toStudentRecords, type StudentRecord } from "@/lib/analysis/stats";
import { deriveAssessmentTitle } from "@/lib/analysis/reportMeta";
import { dateFromFileName } from "@/lib/analysis/studentProgress";

/** An extra assessment file added for comparing a student's performance. It is read in
 * the browser only — never uploaded or shared — so every role may add them. */
export interface AssessmentFile {
  id: string;
  label: string;
  fileName: string;
  records: StudentRecord[];
  /** yyyy-mm-dd, read from the file name when it has one; "" when unknown. */
  date: string;
}

/** Id of the shared dataset in `order`. */
export const PRIMARY_ID = "primary";

interface Ctx {
  files: AssessmentFile[];
  /** Test-wise order of every assessment, including the shared dataset (PRIMARY_ID). */
  order: string[];
  /** Date set for the shared dataset; null = read it from its file name. */
  primaryDate: string | null;
  loading: boolean;
  errors: string[];
  addFiles: (files: File[]) => Promise<void>;
  removeFile: (id: string) => void;
  renameFile: (id: string, label: string) => void;
  /** Sets a file's date; PRIMARY_ID sets the shared dataset's. */
  setDate: (id: string, date: string) => void;
  /** Moves an assessment one place earlier (-1) or later (+1) in the test-wise order. */
  move: (id: string, dir: -1 | 1) => void;
  clearErrors: () => void;
}

const AssessmentFilesContext = createContext<Ctx | null>(null);

let seq = 0;

async function readAssessment(file: File): Promise<AssessmentFile> {
  const source = await parseFile(file);
  const sheet = source.sheets[0];
  if (!sheet) throw new Error(`${file.name}: ${source.warnings[0] ?? "no table found"}`);
  const mapping = detectMapping(sheet, inferColumns(sheet));
  if (!mapping.numeric) throw new Error(`${file.name}: couldn't find a score/marks column`);
  const records = toStudentRecords(sheet, mapping);
  if (!records.length) throw new Error(`${file.name}: no student scores found`);
  return { id: `f${++seq}`, label: deriveAssessmentTitle(file.name) || file.name, fileName: file.name, records, date: dateFromFileName(file.name) };
}

export function AssessmentFilesProvider({ children }: { children: React.ReactNode }) {
  const [files, setFiles] = useState<AssessmentFile[]>([]);
  const [order, setOrder] = useState<string[]>([PRIMARY_ID]);
  const [primaryDate, setPrimaryDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const addFiles = useCallback(async (list: File[]) => {
    setLoading(true);
    setErrors([]);
    const results = await Promise.allSettled(list.map(readAssessment));
    const ok = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const failed = results.flatMap((r) => (r.status === "rejected" ? [r.reason instanceof Error ? r.reason.message : String(r.reason)] : []));
    setFiles((prev) => [...prev, ...ok]);
    setOrder((prev) => [...prev, ...ok.map((f) => f.id)]);
    setErrors(failed);
    setLoading(false);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setOrder((prev) => prev.filter((x) => x !== id));
  }, []);
  const renameFile = useCallback((id: string, label: string) => setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, label } : f))), []);
  const setDate = useCallback((id: string, date: string) => {
    if (id === PRIMARY_ID) setPrimaryDate(date);
    else setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, date } : f)));
  }, []);
  const move = useCallback(
    (id: string, dir: -1 | 1) =>
      setOrder((prev) => {
        const i = prev.indexOf(id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      }),
    []
  );
  const clearErrors = useCallback(() => setErrors([]), []);

  const value = useMemo(
    () => ({ files, order, primaryDate, loading, errors, addFiles, removeFile, renameFile, setDate, move, clearErrors }),
    [files, order, primaryDate, loading, errors, addFiles, removeFile, renameFile, setDate, move, clearErrors]
  );
  return <AssessmentFilesContext.Provider value={value}>{children}</AssessmentFilesContext.Provider>;
}

export function useAssessmentFiles() {
  const ctx = useContext(AssessmentFilesContext);
  if (!ctx) throw new Error("useAssessmentFiles must be used within AssessmentFilesProvider");
  return ctx;
}
