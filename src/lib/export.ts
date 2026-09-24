import * as XLSX from "xlsx";

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

export function exportRowsCsv(rows: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
