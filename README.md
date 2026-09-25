# InsightChart

A staff web app for analysing student assessment data. Upload Excel, CSV, PDF, Word, TXT, or images with tables, and get an instant score-distribution dashboard, department comparisons, and exportable reports. Files are parsed in the browser; the extracted table is stored on the server and shared with signed-in staff according to their role.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the initial passwords and SMTP settings
npm run db:migrate           # creates the schema and the two initial accounts
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and choose your role on the sign-in page, then sign in as `createradmin123` (Creator Admin) or `admin123` (Administrator) with the initial passwords from `.env.local`. The first sign-in asks you to verify an email address with a one-time code and choose a new password. Until an Administrator uploads a file, everyone sees built-in sample data.

## Roles

| Role | Can |
| --- | --- |
| Creator Admin (`createradmin123`) | Everything, including creating Administrator accounts |
| Administrator (`admin123`) | Upload data; add, edit and delete student records; create/deactivate HOD and Faculty accounts |
| HOD | View everything (including department comparison) and download reports — read-only |
| Faculty | View dashboards, students, charts and download reports — read-only |

Permissions live in one place (`src/lib/auth/permissions.ts`) and are enforced by the proxy (pages), every API route (data), and used by the UI only to hide controls. There is no public sign-up.

## Environment

See `.env.example`. Required: `DATABASE_URL` in production (Supabase), `CREATOR_ADMIN_INITIAL_PASSWORD`, `ADMINISTRATOR_INITIAL_PASSWORD` (only used to create the accounts once), and SMTP settings (`SMTP_USER`, `SMTP_PASS` for Gmail) for welcome emails and one-time codes. Without SMTP, accounts are still created but no email goes out, and first sign-in and password resets show a configuration error — no code is ever faked. Optional: `APP_URL` (sign-in link in emails), `ALLOWED_EMAIL_DOMAINS`.

## Database

Postgres. Production uses **Supabase** via `DATABASE_URL`; without it (local development, tests, e2e) an embedded Postgres ([PGlite](https://pglite.dev)) stores data in `./data/pglite`, so nothing needs installing. Schema migrations (`src/server/migrations.ts`) run automatically on the first request and with `npm run db:migrate`.

The server connects as the database owner and is the only thing that reads or writes the tables. Supabase's public Data API is switched off for them (row level security with no policies, and the `anon`/`authenticated` roles' grants revoked), so the project's anon key can't read accounts, sessions or codes.

Moving from the old SQLite file: set `DATABASE_URL`, then `npm run db:import-sqlite` copies accounts (passwords keep working), the dataset and the audit log from `./data/insightchart.db`.

## Tests

- `npm test` — unit tests, including API role enforcement and the OTP/first-login flows
- `npm run test:e2e` — builds, then runs Playwright against a throwaway embedded database (never `DATABASE_URL`) and a local capture-only SMTP server (`e2e/server.ts`)

## Deploying to Vercel

1. Create a Supabase project. Copy **Connect → Transaction pooler** (port 6543) and put the database password in it.
2. Import the repository in Vercel and add these Environment Variables (Production): `DATABASE_URL`, `CREATOR_ADMIN_INITIAL_PASSWORD`, `ADMINISTRATOR_INITIAL_PASSWORD`, `SMTP_USER`, `SMTP_PASS`, `APP_URL` (your site's address, e.g. `https://insightchart.vercel.app`).
3. Keep the Vercel functions in the same region as the database — every page load checks the session in the database. `vercel.json` pins them to Tokyo (`hnd1`) to match Supabase `ap-northeast-1`; change it if the database moves (e.g. Mumbai `bom1` for `ap-south-1`).
4. Deploy. The first request creates the tables and the two initial accounts; or run `npm run db:migrate` locally with the same `DATABASE_URL` first.

Large datasets are gzipped in both directions, so uploads of several MB stay under Vercel's 4.5 MB request/response limit. Supabase backs up the database daily (Point-in-Time Recovery on paid plans).

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

Next.js (App Router) · TypeScript · Postgres (Supabase / PGlite) · Nodemailer · Tailwind CSS v4 · Recharts · SheetJS · pdf.js · Mammoth · Tesseract.js · jsPDF / html2canvas

## Project layout

- `src/lib/parsers/` — per-format file parsers, normalized to a common `ParsedSource` shape
- `src/lib/analysis/` — column inference, score bands, aggregation, and insight generation
- `src/context/AppContext.tsx` — app-wide state (reducer), loading/saving the shared dataset
- `src/lib/auth/permissions.ts` — roles and permissions shared by proxy, API and UI
- `src/server/` — database, migrations, sessions, OTP, email, user and dataset stores
- `src/app/api/` — auth, user-management and dataset API routes
- `src/proxy.ts` — page-level access control
- `src/components/dashboard/` — dashboard sections (summary cards, charts, department analysis, NL box, insights, settings)
- `src/components/charts/` — standalone chart primitives (e.g. the SVG flow diagram)
