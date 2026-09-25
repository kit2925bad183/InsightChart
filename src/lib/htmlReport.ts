import type { ScoreBand } from "./types";

export interface ReportStudent {
  name: string;
  registration: string;
  department: string;
  score: number;
}

export interface BuildReportOptions {
  title: string;
  subtitle: string;
  students: ReportStudent[];
  bands: ScoreBand[];
  generatedAt?: Date;
}

/** Escapes text for safe embedding as HTML content (student names/departments come
 * from the uploaded file, so treat them as untrusted). */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** JSON embedded inside a <script> tag — guard against a raw "</script>" in the
 * data (e.g. a student name) breaking out of the script element. */
function safeJsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const TIER_COLORS: Record<string, string> = { support: "#d03b3b", developing: "#fab219", strong: "#0ca30c" };
const TIER_SOFT: Record<string, string> = { support: "#fbe6e6", developing: "#fff3dc", strong: "#e4f6e4" };
const TIER_LABEL: Record<string, string> = { support: "Needs support", developing: "Developing", strong: "Strong" };

/**
 * Builds a single, fully self-contained HTML file (inline CSS + JS, no external
 * requests, no build step) that reproduces the score-distribution dashboard as a
 * static-but-interactive report: an "All departments" section plus one section per
 * department, each with a clickable bar chart that opens a student-list dialog —
 * so anyone opening the file (no InsightChart access, no original data file) gets
 * the same click-a-bar-to-see-names experience.
 */
export function buildInteractiveReportHtml(opts: BuildReportOptions): string {
  const { title, subtitle, students, bands, generatedAt = new Date() } = opts;
  const departments = Array.from(new Set(students.map((s) => s.department))).filter((d) => d && d !== "—").sort();

  const payload = {
    bands: bands.map((b) => ({ id: b.id, label: b.label, min: b.min, max: b.max, tier: b.tier })),
    students,
    departments,
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} — Score Report</title>
<style>
  :root {
    --page-bg: #eef3fb; --surface: #ffffff; --border: #dde6f3; --border-strong: #c7d6ea;
    --text-primary: #0b1f3a; --text-secondary: #3d5372; --text-muted: #7186a3;
    --accent: #2a78d6; --accent-soft: #e3edfb;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--page-bg); color: var(--text-primary);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .wrap { max-width: 980px; margin: 0 auto; padding: 24px 16px 64px; }
  header { text-align: center; margin-bottom: 24px; }
  header h1 { font-size: 22px; margin: 0 0 4px; }
  header p { font-size: 13px; color: var(--text-muted); margin: 2px 0; }
  .notice {
    display: flex; gap: 8px; align-items: flex-start; background: var(--accent-soft); color: #1c5cab;
    border: 1px solid var(--border-strong); border-radius: 10px; padding: 10px 14px; font-size: 12px; margin-bottom: 20px;
  }
  .card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
    box-shadow: 0 1px 2px rgba(11,31,58,.04), 0 6px 20px rgba(11,31,58,.06);
    padding: 20px; margin-bottom: 20px;
  }
  .card h2 { font-size: 20px; margin: 0 0 2px; }
  .card .sub { font-size: 12px; color: var(--text-secondary); margin: 0 0 14px; font-weight: 600; }
  .chips { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
  .chip { flex: 1; min-width: 120px; border-radius: 12px; padding: 10px 14px; }
  .chip .l { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
  .chip .v { font-size: 19px; font-weight: 800; margin-top: 2px; }
  .hint { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: var(--text-secondary); margin-bottom: 6px; }
  .hint .n { font-weight: 500; text-transform: none; color: var(--text-muted); }
  .legend { display: flex; gap: 14px; font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
  .chart { display: flex; align-items: flex-end; gap: 8px; height: 200px; border-bottom: 1px solid var(--border-strong); padding-bottom: 2px; }
  .barcol { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
  .barcol .val { font-size: 12px; font-weight: 700; margin-bottom: 4px; min-height: 16px; }
  .bar { width: 70%; border-radius: 4px 4px 0 0; cursor: pointer; transition: filter .15s; min-height: 2px; }
  .bar:hover, .bar:focus-visible { filter: brightness(1.08); outline: 2px solid var(--accent); outline-offset: 2px; }
  .barcol .lbl { font-size: 10px; color: var(--text-muted); margin-top: 6px; text-align: center; }
  .foot { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border); }
  dialog.modal { border: none; border-radius: 16px; padding: 0; max-width: 560px; width: calc(100% - 32px); box-shadow: 0 20px 60px rgba(11,31,58,.35); }
  dialog.modal::backdrop { background: rgba(11,31,58,.45); }
  .modal-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 18px; border-bottom: 1px solid var(--border); }
  .modal-head h3 { margin: 0; font-size: 14px; }
  .modal-head p { margin: 2px 0 0; font-size: 11px; color: var(--text-muted); }
  .modal-head button { border: none; background: transparent; font-size: 16px; cursor: pointer; color: var(--text-muted); line-height: 1; padding: 4px; }
  .modal-body { padding: 14px 18px 18px; max-height: 60vh; overflow-y: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; background: #f2f6fc; padding: 8px 10px; font-weight: 700; color: var(--text-secondary); }
  td { padding: 6px 10px; border-top: 1px solid var(--border); }
  tr:hover td { background: var(--accent-soft); }
  .empty { text-align: center; color: var(--text-muted); padding: 24px; font-size: 12px; }
  @media print { .bar { cursor: default; } dialog.modal { display: none !important; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(subtitle)}</p>
    <p>Generated ${escapeHtml(generatedAt.toLocaleString())} · InsightChart</p>
  </header>
  <div class="notice">📊 This is a standalone report — click any bar below to see the student list for that score range. No login or original file needed.</div>
  <div id="sections"></div>
</div>

<dialog class="modal" id="dlg">
  <div class="modal-head">
    <div>
      <h3 id="dlgTitle"></h3>
      <p id="dlgSub"></p>
    </div>
    <button id="dlgClose" aria-label="Close">✕</button>
  </div>
  <div class="modal-body">
    <table>
      <thead><tr><th>Name</th><th>Registration No</th><th>Department</th><th>Score</th></tr></thead>
      <tbody id="dlgBody"></tbody>
    </table>
    <div id="dlgEmpty" class="empty" style="display:none">No students in this range.</div>
  </div>
</dialog>

<script id="report-data" type="application/json">${safeJsonForScript(payload)}</script>
<script>
(function () {
  var DATA = JSON.parse(document.getElementById('report-data').textContent);
  var TIER_COLORS = ${safeJsonForScript(TIER_COLORS)};
  var TIER_SOFT = ${safeJsonForScript(TIER_SOFT)};
  var TIER_LABEL = ${safeJsonForScript(TIER_LABEL)};

  // Escapes quotes too: values are also placed inside HTML attributes (aria-label, data-band).
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function bandFor(score) {
    for (var i = 0; i < DATA.bands.length; i++) { var b = DATA.bands[i]; if (score >= b.min && score <= b.max) return b; }
    return DATA.bands[DATA.bands.length - 1];
  }
  function mean(nums) { return nums.length ? nums.reduce(function (a, b) { return a + b; }, 0) / nums.length : 0; }
  function round1(n) { return Math.round(n * 10) / 10; }
  function strongMinOf(bands) { var s = bands.filter(function (b) { return b.tier === 'strong'; }).map(function (b) { return b.min; }); return s.length ? Math.min.apply(null, s) : bands[bands.length - 1].min; }
  function supportMaxOf(bands) { var s = bands.filter(function (b) { return b.tier === 'support'; }).map(function (b) { return b.max; }); return s.length ? Math.max.apply(null, s) : bands[0].max; }

  var dlg = document.getElementById('dlg');
  document.getElementById('dlgClose').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });

  function openModal(sectionLabel, band, sectionStudents) {
    var rows = sectionStudents.filter(function (s) { return s.score >= band.min && s.score <= band.max; }).sort(function (a, b) { return b.score - a.score; });
    document.getElementById('dlgTitle').textContent = sectionLabel + ' · Scoring ' + band.label;
    document.getElementById('dlgSub').textContent = rows.length + ' student' + (rows.length === 1 ? '' : 's') + ' · ' + TIER_LABEL[band.tier];
    var body = document.getElementById('dlgBody');
    body.innerHTML = rows.map(function (s) {
      return '<tr><td>' + esc(s.name) + '</td><td>' + esc(s.registration) + '</td><td>' + esc(s.department) + '</td><td style="font-weight:700;color:' + TIER_COLORS[band.tier] + '">' + esc(s.score) + '</td></tr>';
    }).join('');
    document.getElementById('dlgEmpty').style.display = rows.length ? 'none' : 'block';
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  function renderSection(key, label, sub, sectionStudents) {
    var counts = {};
    DATA.bands.forEach(function (b) { counts[b.id] = 0; });
    sectionStudents.forEach(function (s) { var b = bandFor(s.score); if (b) counts[b.id]++; });
    var maxCount = Math.max(1, Math.max.apply(null, DATA.bands.map(function (b) { return counts[b.id]; })));
    var scores = sectionStudents.map(function (s) { return s.score; });
    var total = sectionStudents.length;
    var avg = total ? round1(mean(scores)) : 0;
    var high = total ? Math.max.apply(null, scores) : 0;
    var low = total ? Math.min.apply(null, scores) : 0;
    var strongMin = strongMinOf(DATA.bands), supportMax = supportMaxOf(DATA.bands);
    var above = sectionStudents.filter(function (s) { return s.score >= strongMin; }).length;
    var below = sectionStudents.filter(function (s) { return s.score <= supportMax; }).length;

    var chips = [
      ['Total students', total, '#2a78d6', '#e3edfb'],
      ['Average score', avg, '#4a3aa7', '#ece9fa'],
      ['Scored ' + strongMin + ' or above', above + ' (' + (total ? Math.round(above / total * 100) : 0) + '%)', '#0ca30c', '#e4f6e4'],
      ['Scored ' + supportMax + ' or below', below + ' (' + (total ? Math.round(below / total * 100) : 0) + '%)', '#d03b3b', '#fbe6e6']
    ];

    var el = document.createElement('div');
    el.className = 'card';
    el.innerHTML =
      '<h2>' + esc(label) + '</h2><p class="sub">' + esc(sub) + '</p>' +
      '<div class="chips">' + chips.map(function (c) {
        return '<div class="chip" style="background:' + c[3] + ';border-left:3px solid ' + c[2] + '">' +
          '<div class="l" style="color:' + c[2] + '">' + esc(c[0]) + '</div><div class="v">' + esc(c[1]) + '</div></div>';
      }).join('') + '</div>' +
      (total === 0 ? '<p class="empty">No students in this group.</p>' :
        '<div class="hint">Number of students <span class="n">— click a bar for the student list</span></div>' +
        '<div class="legend">' + ['strong', 'developing', 'support'].map(function (t) {
          return '<span><span class="dot" style="background:' + TIER_COLORS[t] + '"></span>' + TIER_LABEL[t] + '</span>';
        }).join('') + '</div>' +
        '<div class="chart">' + DATA.bands.map(function (b) {
          var c = counts[b.id];
          var h = Math.round((c / maxCount) * 100);
          return '<div class="barcol">' +
            '<div class="val">' + (c || '') + '</div>' +
            '<div class="bar" role="button" tabindex="0" aria-label="' + esc(label) + ' scoring ' + esc(b.label) + ': ' + c + ' students" style="height:' + Math.max(h, c ? 3 : 0) + '%;background:' + TIER_COLORS[b.tier] + '" data-band="' + esc(b.id) + '"></div>' +
            '<div class="lbl">' + esc(b.label) + '</div>' +
          '</div>';
        }).join('') + '</div>' +
        '<div class="foot"><span>' + esc(label) + ' only</span><span>Score bands: ' + esc(DATA.bands[0].label) + ' through ' + esc(DATA.bands[DATA.bands.length - 1].label) + '</span></div>'
      );

    if (total > 0) {
      el.querySelectorAll('.bar').forEach(function (barEl) {
        var band = DATA.bands.filter(function (b) { return b.id === barEl.getAttribute('data-band'); })[0];
        function activate() { openModal(label, band, sectionStudents); }
        barEl.addEventListener('click', activate);
        barEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
      });
    }
    return el;
  }

  var container = document.getElementById('sections');
  container.appendChild(renderSection('all', 'All departments', DATA.students.length + ' students · ' + DATA.departments.length + ' departments', DATA.students));
  DATA.departments.forEach(function (dept) {
    var deptStudents = DATA.students.filter(function (s) { return s.department === dept; });
    container.appendChild(renderSection(dept, dept, deptStudents.length + ' students', deptStudents));
  });
})();
</script>
</body>
</html>
`;
}

export function downloadInteractiveReport(opts: BuildReportOptions, filename: string) {
  const html = buildInteractiveReportHtml(opts);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.html`;
  link.click();
  URL.revokeObjectURL(link.href);
}
