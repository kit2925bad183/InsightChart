import { getDb } from "@/server/db";
import { ApiError, requireAuth, route } from "@/server/http";
import { getDataset } from "@/server/dataset";
import { toCsv } from "@/server/csv";
import { toStudentRecords } from "@/lib/analysis/stats";

/** Authenticated CSV download of the shared dataset. `format=students` exports the
 * interpreted student list (name/registration/department/score); `format=raw` the active
 * sheet exactly as stored. */
export const GET = route(async (req) => {
  await requireAuth(req, "reports:download");
  const dataset = await getDataset((await getDb()));
  if (!dataset) throw new ApiError(404, "No dataset has been published yet.", "no_dataset");

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "raw" ? "raw" : "students";
  const { source, config } = dataset;
  const sheet = source.sheets.find((s) => s.id === config.activeSheetId) ?? source.sheets[0];

  let csv: string;
  if (format === "raw") {
    csv = toCsv(sheet.headers, sheet.rows);
  } else {
    const records = toStudentRecords(sheet, config.mapping, config.normalizeDepartments, config.departmentOverrides);
    csv = toCsv(
      ["Name", "Registration", "Department", "Score"],
      records.map((r) => ({ Name: r.name, Registration: r.registration, Department: r.department, Score: r.score }))
    );
  }

  const base = (source.fileName || "insightchart").replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-").slice(0, 60) || "insightchart";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${base}-${format}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
