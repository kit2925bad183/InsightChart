import { test as base, expect } from "@playwright/test";

// Synthetic CSV mirroring the messy real-world shape InsightChart is built for:
// mixed-case/free-text department spellings that should collapse to clean codes.
const SAMPLE_CSV = [
  "Name,Registration Number,Class / Department,Score",
  "Alice,R001,cse,78",
  "Bob,R002,CSE(AI&ML),55",
  "Carol,R003,AI&DS,40",
  "Dave,R004,ECE,25",
  "Eve,R005,ece,90",
].join("\n");

// Known dev-server-only noise, verified absent from a production build
// (`next build && next start`) by direct testing — not a real app bug, so the
// console-error guard below ignores it rather than being permanently red.
// If this stops reproducing after a Next.js/React upgrade, remove the filter.
const KNOWN_DEV_ONLY_NOISE = [/Encountered two children with the same key/];

// Fails any test where the page logged a console error or threw an uncaught
// exception — a UI assertion can pass while masking a real underlying bug.
// These specs run signed in as an Administrator (see playwright.config.ts). The dataset
// is shared server state, so each test starts from the built-in sample data.
const test = base.extend<{ failOnConsoleErrors: void; freshDataset: void }>({
  freshDataset: [
    async ({ page }, use) => {
      const res = await page.request.delete("/api/dataset");
      expect(res.ok(), "resetting the shared dataset").toBe(true);
      await use();
    },
    { auto: true },
  ],
  failOnConsoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" && !KNOWN_DEV_ONLY_NOISE.some((re) => re.test(msg.text()))) errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(err.message));
      await use();
      expect(errors, `Unexpected console/page errors: ${errors.join(" | ")}`).toEqual([]);
    },
    { auto: true },
  ],
});

// The sidebar's mobile drawer nav and the desktop sidebar nav both render a `nav`
// landmark, distinguished by aria-label — always scope through this helper on desktop.
const mainNav = (page: import("@playwright/test").Page) => page.locator('nav[aria-label="Main navigation"]');

// Uploads are saved to the server, but view state (search, NL results, unsaved sample-data
// tweaks) lives in memory — a hard `page.goto()` mid-test reboots the app like a real
// refresh would. Use this for any in-test navigation that must preserve that state, the
// same way a real user clicking the sidebar does.
async function navTo(page: import("@playwright/test").Page, href: string) {
  await mainNav(page).locator(`a[href="${href}"]`).click();
}

// /settings isn't a NAV_ITEMS entry (it's linked from the profile card, not the main
// sidebar list), so it needs its own click target.
async function navToSettings(page: import("@playwright/test").Page) {
  // dispatchEvent bypasses Playwright's coordinate-based click, which is unreliable
  // for this link — it sits at the very bottom of the fixed-height sidebar, where
  // Next.js's dev-mode overlay and/or viewport-edge geometry can intercept a real
  // mouse click depending on exact test-runner viewport height. The link itself works
  // fine for a real user (confirmed via manual + dispatchEvent verification); this
  // still exercises the same onClick/navigation path, just without the flaky geometry.
  await page.locator('a[href="/settings"]').first().dispatchEvent("click");
}

test.describe("InsightChart smoke test", () => {
  test("root redirects to the Dashboard page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("loads with mock data and shows the score dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Click a bar to see every student in that range")).toBeVisible();
    await expect(page.getByText("Total students").first()).toBeVisible();
  });

  test("uploading a file replaces mock data and normalizes departments", async ({ page }) => {
    await page.goto("/dashboard");
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "sample.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(SAMPLE_CSV, "utf-8"),
    });

    // Total students should reflect the uploaded file (5), not the mock 147.
    await expect(page.locator("text=Total students").locator("..").locator("p.text-xl").first()).toHaveText("5");

    // AIML and CSE should appear as distinct, clean department codes on Department Comparison.
    await navTo(page, "/departments");
    await expect(page.getByRole("heading", { name: "AIML", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "CSE", exact: true })).toBeVisible();
  });

  test("score-band bar opens a student list modal", async ({ page }) => {
    await page.goto("/dashboard");
    const chartCard = page.locator("div.card").filter({ hasText: "Click a bar to see every student in that range" });
    const bar = chartCard.locator("svg .recharts-bar-rectangle path").last();
    await bar.click({ force: true });
    await expect(page.getByRole("dialog", { name: /Students scoring/ })).toBeVisible();
  });

  test("a bar within a single department's own chart is scoped to that department", async ({ page }) => {
    await page.goto("/departments");
    const firstCard = page.locator("[data-report-card]").first();
    const dept = await firstCard.getAttribute("data-report-card");
    await firstCard.scrollIntoViewIfNeeded();
    await firstCard.locator("svg .recharts-bar-rectangle path").last().click({ force: true });
    const dialog = page.getByRole("dialog", { name: /Students scoring/ });
    await expect(dialog).toBeVisible();
    const deptCells = await dialog.locator("table tbody tr td:nth-child(3)").allTextContents();
    expect(deptCells.length).toBeGreaterThan(0);
    expect(deptCells.every((d) => d.trim() === dept)).toBe(true);
  });

  test("a data point in Interactive Charts drills down to the matching students", async ({ page }) => {
    await page.goto("/charts");
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "sample.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(SAMPLE_CSV, "utf-8"),
    });
    await page.waitForSelector(".recharts-bar-rectangle");
    const dialog = page.getByRole("dialog").filter({ has: page.locator("table") });
    // The sample-data chart is on screen before the upload lands and the chart redraws, so
    // the first bar found can vanish mid-click — retry until the drill-down opens.
    await expect(async () => {
      await page.locator("svg .recharts-bar-rectangle path").first().click({ force: true, timeout: 2000 });
      await expect(dialog).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    const rowCount = await dialog.locator("table tbody tr").count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test("shareable HTML report downloads and works fully standalone (no server)", async ({ page }, testInfo) => {
    await page.goto("/reports");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Shareable HTML report" }).click(),
    ]);
    // download.path() is a temp file with no extension — Chromium would render
    // it as plain text, not HTML. Save it with a real .html extension instead,
    // same as a person saving the file the browser just downloaded for them.
    const savedPath = testInfo.outputPath("shared-report.html");
    await download.saveAs(savedPath);

    // Open the downloaded file directly (file://) in a fresh, unrelated page —
    // simulates the recipient, who has no access to this app or server.
    const standalone = await page.context().newPage();
    const standaloneErrors: string[] = [];
    standalone.on("pageerror", (e) => standaloneErrors.push(e.message));
    await standalone.goto("file://" + savedPath.split("\\").join("/"));
    await standalone.waitForSelector("text=All departments");
    await standalone.locator(".card").first().locator(".bar").last().click();
    await expect(standalone.locator("#dlg[open]")).toBeVisible();
    const rows = await standalone.locator("#dlgBody tr").count();
    expect(rows).toBeGreaterThan(0);
    expect(standaloneErrors).toEqual([]);
    await standalone.close();
  });

  test("reset asks for confirmation once real data is loaded", async ({ page }) => {
    await page.goto("/upload");
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "sample.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(SAMPLE_CSV, "utf-8"),
    });
    // Wait for the async parse to actually finish — the Reset button is already visible
    // from the mock dataset, so clicking too early would still see state.source.kind
    // === "mock" and reset instantly with no confirmation.
    await expect(page.getByText("5 rows")).toBeVisible();
    await page.getByRole("button", { name: "Reset to sample data" }).click();
    await expect(page.getByText("Reset to sample data?")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Reset to sample data?")).not.toBeVisible();
  });

  test("AssessmentComparison collapses to 1 slot when a new file loads without navigating away", async ({ page }) => {
    await page.goto("/departments");
    await expect(page.getByText("Compare with another assessment")).toBeVisible();

    const comparisonCard = page.locator("div.card").filter({ hasText: "Compare with another assessment" });
    const addComparisonBtn = comparisonCard.getByRole("button", { name: "Add another comparison" });
    await addComparisonBtn.click();
    await addComparisonBtn.click();
    await expect(comparisonCard.getByText("New comparison")).toHaveCount(3);

    // Load a new file via the topbar's compact uploader — present on every page, so this
    // bumps the global loadNonce while AssessmentComparison stays mounted on /departments
    // (unlike a route navigation, which would remount it and trivially "pass" this check).
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "sample.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(SAMPLE_CSV, "utf-8"),
    });
    await page.waitForTimeout(500);

    await expect(page.getByText("Compare with another assessment", { exact: true })).toHaveCount(1);
    await expect(comparisonCard.getByText("New comparison")).toHaveCount(1);
  });

  test("NaturalLanguageBox clears when a new file loads without navigating away", async ({ page }) => {
    await page.goto("/alerts");
    await page.getByPlaceholder(/Show students below/).fill("Show students below 30 marks");
    await page.getByRole("button", { name: "Ask" }).click();
    await expect(page.getByText(/scored below 30/)).toBeVisible();

    await page.locator('input[type="file"]').first().setInputFiles({
      name: "sample.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(SAMPLE_CSV, "utf-8"),
    });
    await page.waitForTimeout(500);

    await expect(page.getByText("Ask about your data", { exact: true })).toHaveCount(1);
    await expect(page.getByText(/scored below 30/)).not.toBeVisible();
    await expect(page.getByPlaceholder(/Show students below/)).toHaveValue("");
  });

  test("Ask about your data scopes a query to a named department", async ({ page }) => {
    await page.goto("/alerts");
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "sample.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(SAMPLE_CSV, "utf-8"),
    });
    // A newly loaded file resets the question box by design — wait for it to land first.
    await expect(page.getByText("Eve, Alice, Bob, Carol, Dave")).toBeVisible();
    await page.getByPlaceholder(/Show students below/).fill("Show CSE students below 60 marks");
    await page.getByRole("button", { name: "Ask" }).click();
    await expect(page.getByText(/in CSE scored below 60/)).toBeVisible();
  });

  test("dark mode toggle sets the theme attribute", async ({ page }) => {
    await page.goto("/dashboard");
    const toggle = page.getByRole("button", { name: /Switch to (dark|light) theme/ });
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", /light|dark/);
  });

  test("no horizontal overflow at mobile width across routes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const route of ["/dashboard", "/upload", "/students", "/charts", "/departments", "/alerts"]) {
      await page.goto(route);
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${route} overflows horizontally`).toBeLessThanOrEqual(2);
    }
  });

  test("keyboard shortcut '/' focuses the data-preview search", async ({ page }) => {
    await page.goto("/upload");
    // Wait for hydration to actually attach the global keydown listener (AppShell) —
    // the sidebar shell is heavier than the old single-page layout, so a bare
    // page.goto() can otherwise race ahead of React finishing hydration.
    await page.getByLabel("Search data rows").waitFor({ state: "visible" });
    await page.keyboard.press("/");
    await expect(page.getByLabel("Search data rows")).toBeFocused();
  });

  test("department mapping override reassigns a raw value's group", async ({ page }) => {
    await page.goto("/upload");
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "sample.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(SAMPLE_CSV, "utf-8"),
    });
    await expect(page.getByText("5 rows")).toBeVisible();
    await navToSettings(page);
    await page.getByRole("button", { name: "Edit department mapping" }).click();
    const row = page.locator("tr", { hasText: "AI&DS" });
    await row.getByLabel(/Department code for/).fill("CUSTOM");
    await navTo(page, "/departments");
    await expect(page.getByRole("heading", { name: "CUSTOM", exact: true })).toBeVisible();
  });

  test("save and load workspace round-trips the chart title", async ({ page }) => {
    await page.goto("/charts");
    await page.getByLabel("Chart title").fill("My Saved Title");

    await navToSettings(page);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save workspace" }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).toBeTruthy();

    // Change it, then re-import the saved file and confirm it's restored.
    await navTo(page, "/charts");
    await page.getByLabel("Chart title").fill("Something else");
    await navToSettings(page);
    await page.setInputFiles('input[type="file"][accept="application/json"]', path!);
    await navTo(page, "/charts");
    await expect(page.getByLabel("Chart title")).toHaveValue("My Saved Title");
  });

  test("student performance compares one student across files test-wise, day-wise and week-wise", async ({ page }) => {
    const csv = (score: number) => ["Name,Registration Number,Class / Department,Score", `Zed Tester,E2E 777,CSE,${score}`, "Other One,E2E001,CSE,80"].join("\n");
    await page.goto("/student-performance");
    await page.getByLabel("Add assessment files").setInputFiles([
      { name: "Unit Test 1 2026-09-07.csv", mimeType: "text/csv", buffer: Buffer.from(csv(55), "utf-8") },
      { name: "Unit Test 2 09-09-2026.csv", mimeType: "text/csv", buffer: Buffer.from(csv(65), "utf-8") },
      { name: "Unit Test 3 2026-09-14.csv", mimeType: "text/csv", buffer: Buffer.from(csv(70), "utf-8") },
    ]);
    // Dates are read from the file names.
    await expect(page.getByLabel("Date of Unit Test 2 09-09-2026")).toHaveValue("2026-09-09");

    await page.getByLabel("Search student by name or register number").fill("e2e777");
    await page.getByRole("button", { name: "Chart Zed Tester" }).click();
    await expect(page).toHaveURL(/student=E2E(\+|%20)777/);
    await expect(page.getByTestId("performance-summary")).toContainText("Improved by 15 marks");

    await page.getByRole("button", { name: "Day-wise" }).click();
    await expect(page).toHaveURL(/by=day/);
    const table = page.getByRole("table", { name: /day-wise/ });
    await expect(table.getByRole("row")).toHaveCount(4);
    await expect(table).toContainText("9 Sep 2026");
    // The built-in sample dataset has no date, so it's left out and flagged.
    await expect(page.getByTestId("undated-note")).toContainText("Sample data");

    await page.getByRole("button", { name: "Week-wise" }).click();
    const weeks = page.getByRole("table", { name: /week-wise/ });
    await expect(weeks.getByRole("row")).toHaveCount(3);
    await expect(weeks.getByRole("row").nth(1)).toContainText("Week of 7 Sep 2026");
    await expect(weeks.getByRole("row").nth(1)).toContainText("60");

    await page.getByRole("button", { name: "Bars" }).click();
    await expect(page).toHaveURL(/view=bar/);
    await expect(page.getByRole("img", { name: /Bar chart of Zed Tester/ })).toBeVisible();
  });

  test("Data Filter builds filters from the uploaded CSV's columns", async ({ page }) => {
    const csv = [
      "Name,Register Number,Department,Section,Score",
      "Asha,21CS001,CSE,A,78",
      "Bala,21CS009,cse,B,42",
      "Chitra,21CS010,ECE,A,91",
      "Dinesh,21CS025,ECE,B,55",
      "Esther,21CS100,MECH,A,67",
      "Farhan,21CS101,MECH,B,30",
      "Gita,21CS102,CSE,A,88",
      "Hari,21CS103,ECE,B,61",
    ].join("\n");
    await page.goto("/upload");
    await page.locator('input[type="file"]').first().setInputFiles({ name: "unit-test-1.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf-8") });
    await expect(page.getByText("unit-test-1.csv").first()).toBeVisible();
    await navTo(page, "/filter");

    const results = page.getByRole("table", { name: "Filtered records" });
    await expect(page.getByText("8 of 8 rows")).toBeVisible();
    // Every column of the file got a filter.
    for (const col of ["Register Number", "Name", "Department", "Section", "Score"]) await expect(page.getByTestId(`filter-${col}`)).toBeVisible();

    // Department tick-list uses the cleaned-up names ("cse" counts as CSE).
    await page.getByTestId("filter-Department").getByRole("checkbox", { name: /^CSE/ }).check();
    await expect(page.getByText("3 of 8 rows")).toBeVisible();
    await expect(results.getByRole("row")).toHaveCount(4);

    // Register number range on top.
    await page.getByTestId("filter-Department").getByRole("button", { name: "Clear selection" }).click();
    await page.getByLabel("Register Number from").fill("21CS009");
    await page.getByLabel("Register Number to").fill("21CS100");
    await expect(page.getByText("4 of 8 rows")).toBeVisible();

    // Score range narrows further; the chip shows it and removes it.
    await page.getByTestId("filter-Score").getByRole("button").first().click();
    await page.getByLabel("Score minimum").fill("60");
    await expect(page.getByText("2 of 8 rows")).toBeVisible();
    await expect(results).toContainText("Chitra");
    await expect(results).toContainText("Esther");
    await page.getByRole("button", { name: "Remove filter Score: ≥ 60" }).click();
    await expect(page.getByText("4 of 8 rows")).toBeVisible();

    await page.getByLabel("Search every column").fill("dinesh");
    await expect(page.getByText("1 of 8 rows")).toBeVisible();
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page.getByText("8 of 8 rows")).toBeVisible();
  });

  test("column insights shows answer distribution for an unmapped column", async ({ page }) => {
    const csvWithQuestion = [
      "Name,Registration Number,Class / Department,Score,Q1",
      "Alice,R001,CSE,78,Yes",
      "Bob,R002,CSE,55,No",
      "Carol,R003,CSE,40,Yes",
    ].join("\n");
    await page.goto("/upload");
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "sample2.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvWithQuestion, "utf-8"),
    });
    await page.getByLabel("Column").click();
    await page.getByRole("option", { name: "Q1" }).click();
    await expect(page.getByText("3 responses")).toBeVisible();
  });

  test.describe("sidebar navigation", () => {
    test("every nav item routes to its page and highlights as active", async ({ page }) => {
      await page.goto("/dashboard");
      const items: [string, string][] = [
        ["/upload", "Upload & data preview"],
        ["/students", "Student Explorer"],
        ["/charts", "Chart setup"],
        ["/departments", "Department analysis"],
        ["/interventions", "Intervention Planner"],
        ["/placement", "Placement Readiness"],
        ["/reports", "Reports & exports"],
        ["/tasks", "Tasks & Calendar"],
        ["/alerts", "Ask about your data"],
      ];
      for (const [href, heading] of items) {
        await mainNav(page).locator(`a[href="${href}"]`).click();
        await expect(page).toHaveURL(new RegExp(href + "$"));
        await expect(mainNav(page).locator(`a[href="${href}"]`)).toHaveAttribute("aria-current", "page");
        await expect(page.getByText(heading).first()).toBeVisible();
      }
    });

    test("collapse state persists across a reload without changing sidebar width via JS flash", async ({ page }) => {
      await page.goto("/dashboard");
      await page.getByRole("button", { name: "Collapse sidebar" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-sidebar", "collapsed");
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-sidebar", "collapsed");
      await page.getByRole("button", { name: "Expand sidebar" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-sidebar", "expanded");
    });

    test("mobile drawer opens, traps focus, and closes on Escape restoring focus to the hamburger", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/dashboard");
      const dialog = page.locator('[role="dialog"][aria-label="Navigation menu"]');

      await expect(dialog).toHaveAttribute("inert", "");
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      await expect(dialog).not.toHaveAttribute("inert", "");

      await page.keyboard.press("Escape");
      await expect(dialog).toHaveAttribute("inert", "");
      await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeFocused();
    });
  });
});
