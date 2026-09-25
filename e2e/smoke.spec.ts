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
const test = base.extend<{ failOnConsoleErrors: void }>({
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

test.describe("InsightChart smoke test", () => {
  test("loads with mock data and shows the score dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Click a bar to see every student in that range")).toBeVisible();
    await expect(page.getByText("Total students").first()).toBeVisible();
  });

  test("uploading a file replaces mock data and normalizes departments", async ({ page }) => {
    await page.goto("/");
    const buffer = Buffer.from(SAMPLE_CSV, "utf-8");
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "sample.csv",
      mimeType: "text/csv",
      buffer,
    });

    // Total students should reflect the uploaded file (5), not the mock 147.
    await expect(page.locator("text=Total students").locator("..").locator("p.text-xl").first()).toHaveText("5");

    // AIML and CSE should appear as distinct, clean department codes.
    await expect(page.getByRole("heading", { name: "AIML", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "CSE", exact: true })).toBeVisible();
  });

  test("score-band bar opens a student list modal", async ({ page }) => {
    await page.goto("/");
    const chartCard = page.locator("div.card").filter({ hasText: "Click a bar to see every student in that range" });
    const bar = chartCard.locator("svg .recharts-bar-rectangle path").last();
    await bar.click({ force: true });
    await expect(page.getByRole("dialog", { name: /Students scoring/ })).toBeVisible();
  });

  test("a bar within a single department's own chart is scoped to that department", async ({ page }) => {
    await page.goto("/");
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

  test("shareable HTML report downloads and works fully standalone (no server)", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.waitForSelector("text=Department reports");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download a shareable interactive HTML report" }).click(),
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
    await page.goto("/");
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "sample.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(SAMPLE_CSV, "utf-8"),
    });
    await expect(page.locator("text=Total students").locator("..").locator("p.text-xl").first()).toHaveText("5");
    await page.getByRole("button", { name: "Reset to sample data" }).click();
    await expect(page.getByText("Reset to sample data?")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Reset to sample data?")).not.toBeVisible();
  });

  test("resetting to sample data collapses comparison slots and clears the NL query box", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Compare with another assessment")).toBeVisible();

    const comparisonCard = page.locator("div.card").filter({ hasText: "Compare with another assessment" });
    const addComparisonBtn = comparisonCard.getByRole("button", { name: "Add another comparison" });
    await addComparisonBtn.click();
    await addComparisonBtn.click();
    await expect(comparisonCard.getByText("New comparison")).toHaveCount(3);

    await page.getByPlaceholder(/Show students below/).fill("Show students below 30 marks");
    await page.getByRole("button", { name: "Ask" }).click();
    await expect(page.getByText(/scored below 30/)).toBeVisible();

    // Mock data is loaded, so Reset applies immediately with no confirmation dialog.
    await page.getByRole("button", { name: "Reset to sample data" }).click();

    await expect(page.getByText("Compare with another assessment", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Ask about your data", { exact: true })).toHaveCount(1);
    await expect(comparisonCard.getByText("New comparison")).toHaveCount(1);
    await expect(page.getByText(/scored below 30/)).not.toBeVisible();
    await expect(page.getByPlaceholder(/Show students below/)).toHaveValue("");
  });

  test("dark mode toggle sets the theme attribute", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /Switch to (dark|light) theme/ });
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", /light|dark/);
  });

  test("no horizontal overflow at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "sample.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(SAMPLE_CSV, "utf-8"),
    });
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test("keyboard shortcut '/' focuses the data-preview search", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("/");
    await expect(page.getByLabel("Search data rows")).toBeFocused();
  });

  test("department mapping override reassigns a raw value's group", async ({ page }) => {
    await page.goto("/");
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "sample.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(SAMPLE_CSV, "utf-8"),
    });
    await page.getByRole("button", { name: "Edit department mapping" }).click();
    const row = page.locator("tr", { hasText: "AI&DS" });
    await row.getByLabel(/Department code for/).fill("CUSTOM");
    await expect(page.getByRole("heading", { name: "CUSTOM", exact: true })).toBeVisible();
  });

  test("save and load workspace round-trips the chart title", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Chart title").fill("My Saved Title");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save workspace" }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).toBeTruthy();

    // Change it, then re-import the saved file and confirm it's restored.
    await page.getByLabel("Chart title").fill("Something else");
    await page.setInputFiles('input[type="file"][accept="application/json"]', path!);
    await expect(page.getByLabel("Chart title")).toHaveValue("My Saved Title");
  });

  test("column insights shows answer distribution for an unmapped column", async ({ page }) => {
    const csvWithQuestion = [
      "Name,Registration Number,Class / Department,Score,Q1",
      "Alice,R001,CSE,78,Yes",
      "Bob,R002,CSE,55,No",
      "Carol,R003,CSE,40,Yes",
    ].join("\n");
    await page.goto("/");
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "sample2.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvWithQuestion, "utf-8"),
    });
    await page.getByLabel("Column").click();
    await page.getByRole("option", { name: "Q1" }).click();
    await expect(page.getByText("3 responses")).toBeVisible();
  });
});
