# InsightChart

A single-user web app for analysing student assessment data. Upload Excel, CSV, PDF, Word, TXT, or images with tables, and get an instant score-distribution dashboard, department comparisons, and exportable reports — all processed locally in the browser.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard loads with sample placement-assessment data so it's immediately usable — upload your own file (or drag one onto the upload area) to replace it.

## What it does

- **Upload & parse** — `.xlsx` / `.xls` / `.csv` (SheetJS), `.pdf` (pdf.js text/table extraction), `.docx` (Mammoth table extraction), `.txt` (delimiter heuristics), and images (Tesseract.js OCR, experimental). Everything runs client-side; no file is sent to a server.
- **Auto-detection** — headers, numeric columns, dates, and a best-guess "Score" column, student-name, registration, and department columns.
- **Score dashboard** — summary cards, a colour-coded score-distribution bar chart (red/amber/green by performance tier), click-to-drill student lists, and a per-student detail view.
- **Department analysis** — per-department view, filtering, and a side-by-side compare mode with an exportable comparison report image.
- **Custom chart builder** — bar, grouped/stacked bar, pie/donut, line, area, scatter, histogram, heatmap, a relationship flow diagram, and a table summary, all driven by column mapping.
- **Natural-language box** — rule-based parsing (no external API) for queries like "Show students below 30 marks" or "Compare CSBS and CSE average scores".
- **Insights panel** — automatic findings (top department, busiest score band, students below threshold, top 5).
- **Exports** — PNG, PDF, and CSV for charts and reports.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Recharts · SheetJS · pdf.js · Mammoth · Tesseract.js · jsPDF / html2canvas

## Project layout

- `src/lib/parsers/` — per-format file parsers, normalized to a common `ParsedSource` shape
- `src/lib/analysis/` — column inference, score bands, aggregation, and insight generation
- `src/context/AppContext.tsx` — app-wide state (reducer)
- `src/components/dashboard/` — dashboard sections (summary cards, charts, department analysis, NL box, insights, settings)
- `src/components/charts/` — standalone chart primitives (e.g. the SVG flow diagram)
