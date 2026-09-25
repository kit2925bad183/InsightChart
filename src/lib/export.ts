function currentSurfaceColor(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();
  return v || "#ffffff";
}

export async function exportChartPng(node: HTMLElement, filename: string) {
  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(node, { backgroundColor: currentSurfaceColor(), scale: 2 });
  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export async function exportChartPdf(node: HTMLElement, filename: string) {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");
  const canvas = await html2canvas(node, { backgroundColor: currentSurfaceColor(), scale: 2 });
  const imgData = canvas.toDataURL("image/png");
  const orientation = canvas.width > canvas.height ? "l" : "p";
  const pdf = new jsPDF({ orientation, unit: "px", format: [canvas.width, canvas.height] });
  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save(`${filename}.pdf`);
}

/** Captures each element as its own PDF page (rather than one giant stitched image),
 * so a report bundling many sections/cards stays readable at print resolution. */
export async function exportMultiPagePdf(nodes: HTMLElement[], filename: string) {
  if (!nodes.length) return;
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");
  const bg = currentSurfaceColor();

  let pdf: InstanceType<typeof jsPDF> | null = null;
  for (const node of nodes) {
    const canvas = await html2canvas(node, { backgroundColor: bg, scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const orientation = canvas.width > canvas.height ? "l" : "p";
    if (!pdf) {
      pdf = new jsPDF({ orientation, unit: "px", format: [canvas.width, canvas.height] });
    } else {
      pdf.addPage([canvas.width, canvas.height], orientation);
    }
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
  }
  pdf!.save(`${filename}.pdf`);
}

// Cells starting with these run as formulas when the CSV is opened in Excel/Sheets, so a
// crafted value in an uploaded file (e.g. a "name" of =HYPERLINK(...)) could act on whoever
// opens the download. Same rule as the server's export (src/server/csv.ts).
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function neutraliseFormula(v: unknown): unknown {
  return typeof v === "string" && FORMULA_PREFIX.test(v) ? `'${v}` : v;
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(neutraliseFormula(v));
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows → CSV text. Columns are every key that appears, in first-seen order. Written by
 * hand (not with SheetJS) so downloading a CSV doesn't pull a spreadsheet library into
 * every page. */
export function rowsToCsv(rows: Record<string, unknown>[]): string {
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k);
        headers.push(k);
      }
    }
  }
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(","));
  return lines.join("\r\n") + "\r\n";
}

export function exportRowsCsv(rows: Record<string, unknown>[], filename: string) {
  // The byte-order mark makes Excel read UTF-8, so names in Tamil and other scripts open correctly.
  const blob = new Blob(["﻿" + rowsToCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}
