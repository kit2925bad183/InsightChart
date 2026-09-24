import { parseWorkbook } from "./xlsxCore";

export interface XlsxWorkerRequest {
  type: "array" | "string";
  data: ArrayBuffer | string;
  singleSheetName?: string;
}

export type XlsxWorkerResponse =
  | { ok: true; sheets: ReturnType<typeof parseWorkbook>["sheets"]; warnings: string[] }
  | { ok: false; error: string };

self.onmessage = (e: MessageEvent<XlsxWorkerRequest>) => {
  try {
    const { type, data, singleSheetName } = e.data;
    const result = parseWorkbook(data, type, singleSheetName);
    const response: XlsxWorkerResponse = { ok: true, sheets: result.sheets, warnings: result.warnings };
    self.postMessage(response);
  } catch (err) {
    const response: XlsxWorkerResponse = { ok: false, error: err instanceof Error ? err.message : "Unknown parsing error" };
    self.postMessage(response);
  }
};
