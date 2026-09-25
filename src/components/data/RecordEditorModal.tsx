"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/context/AppContext";
import { coerceCellInput } from "@/lib/datasetEdits";
import type { CellValue, DataSheet } from "@/lib/types";

/** Add or correct one record in the shared dataset (Administrator / Creator Admin only —
 * callers render it only when `canEdit`, and the API enforces the same rule). */
export function RecordEditorModal({
  sheet,
  rowIndex,
  onClose,
}: {
  sheet: DataSheet;
  /** null = add a new record */
  rowIndex: number | null;
  onClose: () => void;
}) {
  const { saveRowOp } = useApp();
  const original = rowIndex === null ? null : sheet.rows[rowIndex];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(sheet.headers.map((h) => [h, original?.[h] === null || original?.[h] === undefined ? "" : String(original[h])]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await fn();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the change.");
      setSaving(false);
    }
  };

  const onSave = () =>
    run(async () => {
      const changed: Record<string, CellValue> = {};
      for (const h of sheet.headers) {
        const next = coerceCellInput(values[h] ?? "", original?.[h]);
        if (rowIndex === null ? next !== null : next !== (original?.[h] ?? null)) changed[h] = next;
      }
      if (rowIndex === null) {
        if (!Object.keys(changed).length) throw new Error("Fill in at least one field.");
        await saveRowOp({ type: "add", sheetId: sheet.id, values: changed });
      } else {
        if (!Object.keys(changed).length) return;
        await saveRowOp({ type: "update", sheetId: sheet.id, index: rowIndex, values: changed });
      }
    });

  return (
    <Modal title={rowIndex === null ? "Add student record" : "Edit student record"} subtitle={`Sheet: ${sheet.name}`} onClose={onClose} width="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
        className="space-y-3"
      >
        <div className="grid sm:grid-cols-2 gap-3">
          {sheet.headers.map((h) => (
            <label key={h} className="flex flex-col gap-1 text-xs font-medium text-[var(--text-secondary)] min-w-0">
              <span className="truncate" title={h}>
                {h}
              </span>
              <input
                value={values[h] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [h]: e.target.value }))}
                className="text-sm rounded-lg border border-[var(--border-strong)] bg-white px-2.5 py-1.5 text-[var(--text-primary)]"
              />
            </label>
          ))}
        </div>

        {error && (
          <p role="alert" className="text-xs text-[var(--status-critical)]">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          {rowIndex !== null ? (
            confirmDelete ? (
              <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                Delete this record?
                <Button
                  type="button"
                  size="sm"
                  disabled={saving}
                  onClick={() => run(() => saveRowOp({ type: "delete", sheetId: sheet.id, index: rowIndex }))}
                  className="!bg-[var(--status-critical)] !text-white !border-transparent"
                >
                  Yes, delete
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  No
                </Button>
              </span>
            ) : (
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} className="!text-[var(--status-critical)]">
                <Trash2 size={13} /> Delete record
              </Button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving…" : rowIndex === null ? "Add record" : "Save changes"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
