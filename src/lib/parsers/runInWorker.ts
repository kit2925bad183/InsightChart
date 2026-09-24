import { parseWorkbook, type WorkbookResult } from "./xlsxCore";
import type { XlsxWorkerRequest, XlsxWorkerResponse } from "./xlsx.worker";

/**
 * Parses a workbook off the main thread so large files don't freeze the UI.
 * Falls back to synchronous main-thread parsing if Workers aren't available
 * (older browsers, or a bundler/runtime edge case) so the feature still works.
 */
export function parseWorkbookOffMainThread(
  data: ArrayBuffer | string,
  type: "array" | "string",
  singleSheetName?: string
): Promise<WorkbookResult> {
  if (typeof Worker === "undefined") {
    return Promise.resolve(parseWorkbook(data, type, singleSheetName));
  }

  return new Promise((resolve) => {
    let settled = false;
    let worker: Worker;
    try {
      worker = new Worker(new URL("./xlsx.worker.ts", import.meta.url), { type: "module" });
    } catch {
      resolve(parseWorkbook(data, type, singleSheetName));
      return;
    }

    const finish = (result: WorkbookResult) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      resolve(result);
    };

    worker.onmessage = (e: MessageEvent<XlsxWorkerResponse>) => {
      if (e.data.ok) finish({ sheets: e.data.sheets, warnings: e.data.warnings });
      else finish(parseWorkbook(data, type, singleSheetName));
    };
    worker.onerror = () => finish(parseWorkbook(data, type, singleSheetName));

    // Transfer a copy of the buffer (not the original) so `data` stays usable
    // on the main thread for the fallback path if the worker fails.
    if (type === "array" && data instanceof ArrayBuffer) {
      const transferable = data.slice(0);
      worker.postMessage({ type, data: transferable, singleSheetName } satisfies XlsxWorkerRequest, [transferable]);
    } else {
      worker.postMessage({ type, data, singleSheetName } satisfies XlsxWorkerRequest);
    }
  });
}
