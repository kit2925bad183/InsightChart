import { test, expect, request, type Page, type APIRequestContext } from "@playwright/test";
import { E2E, storageStatePath, waitForMailField, waitForOtp } from "./fixtures";

const nav = (page: Page) => page.locator('nav[aria-label="Main navigation"]');
// Next.js renders its own empty role="alert" route announcer, so scope to our form messages.
const formAlert = (page: Page) => page.getByRole("alert").filter({ hasText: /\S/ });

const DATASET = {
  source: {
    kind: "csv",
    fileName: "marks.csv",
    warnings: [],
    sheets: [
      {
        id: "s1",
        name: "Sheet1",
        headers: ["Name", "Registration Number", "Department", "Score"],
        rows: [
          { Name: "Alice", "Registration Number": "R001", Department: "CSE", Score: 78 },
          { Name: "Bob", "Registration Number": "R002", Department: "ECE", Score: 55 },
          { Name: "Carol", "Registration Number": "R003", Department: "CSE", Score: 40 },
        ],
      },
    ],
  },
  config: {
    activeSheetId: "s1",
    mapping: { studentName: "Name", registration: "Registration Number", department: "Department", numeric: "Score", category: "Department" },
    chartType: "bar",
    scoreBands: [
      { id: "b1", label: "0-49", min: 0, max: 49.99, tier: "support" },
      { id: "b2", label: "50-100", min: 50, max: 100, tier: "strong" },
    ],
    thresholdSupport: 35,
    thresholdStrong: 60,
    chartTitle: "Score Distribution",
    chartAccentIndex: 0,
    normalizeDepartments: true,
    departmentOverrides: {},
  },
};

async function adminApi(baseURL: string): Promise<APIRequestContext> {
  return request.newContext({ baseURL, storageState: storageStatePath("admin") });
}

async function publishDataset(api: APIRequestContext) {
  const res = await api.put("/api/dataset", { data: DATASET });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { version: number }).version;
}

async function signIn(page: Page, identifier: string, password: string, role: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp("^" + role) }).click();
  await page.getByLabel("Username or email").fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function completeFirstLogin(page: Page, email: string, newPassword: string) {
  await expect(page).toHaveURL(/\/first-login$/);
  await page.getByRole("button", { name: /Change password by email/ }).click();
  const since = Date.now();
  await page.getByRole("textbox", { name: /mail address/i }).fill(email);
  await page.getByRole("button", { name: /Send verification code/ }).click();
  await expect(page.getByText(`We sent a 6-digit code to ${email.toLowerCase()}`)).toBeVisible();
  const code = await waitForOtp(email, since);
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Verify code" }).click();
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Set new password and continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("signed out", () => {
  test("every page shows the welcome screen, which continues to sign-in, and the API refuses data", async ({ page }) => {
    for (const path of ["/", "/dashboard", "/students", "/admin/users", "/reports"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/welcome/);
    }
    await page.getByRole("link", { name: "Continue to sign in" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Freports$/);
    await expect(page.getByRole("list", { name: "Choose your role" })).toBeVisible();
    expect((await page.request.get("/api/dataset")).status()).toBe(401);
    expect((await page.request.get("/api/dataset/export")).status()).toBe(401);
  });

  test("wrong credentials show a generic error and there is no public sign-up", async ({ page }) => {
    await signIn(page, "e2e.faculty", "definitely-wrong", "Faculty");
    await expect(formAlert(page)).toHaveText("Incorrect username or password.");
    await expect(page.getByText(/sign up|register|create account/i)).toHaveCount(0);
  });

  test("the sign-in page offers the four roles and rejects a mismatched role", async ({ page }) => {
    await page.goto("/login");
    const roles = page.getByRole("list", { name: "Choose your role" }).getByRole("button");
    await expect(roles).toHaveCount(4);
    await expect(roles.nth(0)).toContainText("Creator Admin");
    await expect(roles.nth(1)).toContainText("Administrator");
    await expect(roles.nth(2)).toContainText("Head of Department");
    await expect(roles.nth(3)).toContainText("Faculty");
    await signIn(page, "e2e.admin", "E2E-admin-Pass-2026", "Faculty");
    await expect(formAlert(page)).toContainText("isn't a Faculty account — it's an Administrator account");
    await expect(page).toHaveURL(/\/login/);
    // One click switches to the right role and signs in with what was already typed.
    await page.getByRole("button", { name: "Sign in as Administrator instead" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("forgot password gives the same answer for an unknown email", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Account email").fill("nobody.here@gmail.com");
    await page.getByRole("button", { name: /Send verification code/ }).click();
    await expect(page.getByText(/If that email belongs to an InsightChart account/)).toBeVisible();
  });
});

for (const who of ["faculty", "hod"] as const) {
  test.describe(`${who} (view only)`, () => {
    test.use({ storageState: storageStatePath(who) });

    test.beforeAll(async ({ baseURL }) => {
      await publishDataset(await adminApi(baseURL!));
    });

    test("sees a view-only dashboard with no upload or management controls", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page.getByTestId("profile-role")).toHaveText(who === "hod" ? "Head of Department" : "Faculty");
      await expect(page.getByText("View only")).toBeVisible();
      await expect(page.getByRole("button", { name: "Upload file" })).toHaveCount(0);
      await expect(page.locator('input[type="file"]')).toHaveCount(0);
      await expect(nav(page).locator('a[href="/admin/users"]')).toHaveCount(0);
      await expect(nav(page).locator('a[href="/upload"]')).toHaveText(/Data Preview/);
      await expect(nav(page).locator('a[href="/departments"]')).toHaveCount(who === "hod" ? 1 : 0);
    });

    test("cannot open user management even by typing the URL", async ({ page }) => {
      const res = await page.goto("/admin/users");
      expect(res?.status()).toBe(403);
      await expect(page.getByText("This page isn't available")).toBeVisible();
    });

    test("has no edit controls on student records", async ({ page }) => {
      await page.goto("/students");
      await expect(page.getByText("3 of 3 students")).toBeVisible();
      await expect(page.getByRole("button", { name: "Add student" })).toHaveCount(0);
      await page.getByRole("cell", { name: "Alice", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Alice" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Edit record" })).toHaveCount(0);
      await page.keyboard.press("Escape");
      await page.goto("/upload");
      await expect(page.getByRole("button", { name: /Edit row/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Reset to sample data" })).toHaveCount(0);
    });

    test("is refused by the API when forging edits from the browser", async ({ page }) => {
      await page.goto("/dashboard");
      // Exactly what someone could paste into dev tools: same-origin fetches with the session cookie.
      const statuses = await page.evaluate(async (dataset) => {
        const call = (url: string, method: string, body?: unknown) =>
          fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.status);
        const { dataset: current } = await fetch("/api/dataset").then((r) => r.json());
        return [
          await call("/api/dataset/rows", "POST", { type: "update", sheetId: "s1", index: 0, values: { Score: 100 }, version: current.version }),
          await call("/api/dataset/rows", "POST", { type: "add", sheetId: "s1", values: { Name: "Mallory" }, version: current.version }),
          await call("/api/dataset", "PUT", dataset),
          await call("/api/dataset", "DELETE"),
          await call("/api/dataset/config", "PUT", { config: dataset.config }),
          await call("/api/users", "POST", { displayName: "Sneaky", email: "sneaky@gmail.com", role: "ADMINISTRATOR", initialPassword: "Sneaky#12345" }),
        ];
      }, DATASET);
      expect(statuses).toEqual([403, 403, 403, 403, 403, 403]);
      await page.goto("/students");
      await expect(page.getByRole("row", { name: /Alice.*78/ })).toBeVisible();
    });

    test("can download reports", async ({ page }) => {
      await page.goto("/reports");
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export all students as CSV" }).click()]);
      expect(download.suggestedFilename()).toMatch(/students\.csv$/);
    });
  });
}

test.describe("administrator", () => {
  test.use({ storageState: storageStatePath("admin") });

  test("corrects a mark and every role sees the change", async ({ page, browser, baseURL }) => {
    await publishDataset(await adminApi(baseURL!));
    await page.goto("/students");
    await page.getByRole("cell", { name: "Bob", exact: true }).click();
    await page.getByRole("button", { name: "Edit record" }).click();
    await page.getByLabel("Score").fill("91");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("row", { name: /Bob.*91/ })).toBeVisible();

    const faculty = await browser.newContext({ storageState: storageStatePath("faculty") });
    const fp = await faculty.newPage();
    await fp.goto("/students");
    await expect(fp.getByRole("row", { name: /Bob.*91/ })).toBeVisible();
    await faculty.close();
  });

  test("creates an HOD who gets their sign-in details by email, completes first login with a real emailed OTP, then gets deactivated", async ({ page, browser }) => {
    await page.goto("/admin/users");
    await expect(page.getByRole("combobox", { name: "Role", exact: true }).locator("option")).toHaveText(["Head of Department", "Faculty"]);
    await page.getByLabel("Full name").fill("Dr. Meena Rao");
    await page.getByLabel("Email address").fill("meena.hod@gmail.com");
    await page.getByRole("combobox", { name: "Role", exact: true }).selectOption("HOD");
    // No password typed: the server generates one and emails it.
    const since = Date.now();
    await page.getByRole("button", { name: "Create account & email details" }).click();
    await expect(page.getByTestId("create-result")).toContainText("emailed their sign-in details to meena.hod@gmail.com");
    await expect(page.getByTestId("user-row-meena.hod")).toContainText("Awaiting first sign-in");
    expect(await waitForMailField("meena.hod@gmail.com", since, "Username")).toBe("meena.hod");
    const firstPassword = await waitForMailField("meena.hod@gmail.com", since, "Initial password");

    // Resending issues a new password and retires the first one.
    const resentAt = Date.now();
    await page.getByRole("button", { name: "Resend login details to Dr. Meena Rao" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Send new details" }).click();
    await expect(page.getByText("New sign-in details sent to meena.hod@gmail.com")).toBeVisible();
    const initialPassword = await waitForMailField("meena.hod@gmail.com", resentAt, "Initial password");
    expect(initialPassword).not.toBe(firstPassword);

    // Explicitly empty: contexts created here would otherwise inherit the admin session.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const hod = await ctx.newPage();
    await signIn(hod, "meena.hod", firstPassword, "Head of Department");
    await expect(formAlert(hod)).toHaveText("Incorrect username or password.");
    await signIn(hod, "meena.hod", initialPassword, "Head of Department");
    await expect(hod).toHaveURL(/\/first-login$/);
    await hod.getByRole("button", { name: /Change password by email/ }).click();
    // Must match the address the administrator registered.
    await hod.getByRole("textbox", { name: /mail address/i }).fill("someone.else@gmail.com");
    await hod.getByRole("button", { name: /Send verification code/ }).click();
    await expect(formAlert(hod)).toContainText("isn't the email address your administrator registered");
    // Nothing else is reachable until setup is finished.
    await hod.goto("/dashboard");
    await expect(hod).toHaveURL(/\/first-login$/);
    await completeFirstLogin(hod, "meena.hod@gmail.com", "Meena-Chosen-2026");
    await expect(hod.getByTestId("profile-role")).toHaveText("Head of Department");

    await page.reload();
    await expect(page.getByTestId("user-row-meena.hod")).toContainText("Active");
    await page.getByTestId("user-row-meena.hod").getByRole("button", { name: "Deactivate" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Deactivate" }).click();
    await expect(page.getByTestId("user-row-meena.hod")).toContainText("Deactivated");

    await hod.goto("/dashboard");
    await expect(hod).toHaveURL(/\/welcome/);
    await signIn(hod, "meena.hod", "Meena-Chosen-2026", "Head of Department");
    await expect(formAlert(hod)).toContainText("deactivated");
    await ctx.close();
  });

  test("a new Faculty member can continue with the current password and is offered the change again", async ({ page, browser }) => {
    await page.goto("/admin/users");
    await page.getByLabel("Full name").fill("Kavin Faculty");
    await page.getByLabel("Email address").fill("kavin.faculty@gmail.com");
    await page.getByRole("combobox", { name: "Role", exact: true }).selectOption("FACULTY");
    await page.getByLabel("Initial password (optional)", { exact: true }).fill("kit@2025");
    await page.getByRole("button", { name: "Create account & email details" }).click();
    await expect(page.getByText(/Created Kavin Faculty/)).toBeVisible();

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const fac = await ctx.newPage();
    await signIn(fac, "kavin.faculty", "kit@2025", "Faculty");
    await expect(fac).toHaveURL(/\/first-login$/);
    await fac.getByRole("button", { name: /Continue with current password/ }).click();
    await expect(fac).toHaveURL(/\/dashboard$/);
    await expect(fac.getByText("You're still using your initial password.", { exact: false })).toBeVisible();

    // The email change stays available from the dashboard banner…
    await fac.getByRole("link", { name: "Change password" }).click();
    await expect(fac).toHaveURL(/\/first-login$/);
    await expect(fac.getByRole("button", { name: /Change password by email/ })).toBeVisible();

    // …and the choice is offered again at the next sign-in.
    await fac.goto("about:blank");
    await ctx.clearCookies();
    await signIn(fac, "kavin.faculty", "kit@2025", "Faculty");
    await expect(fac).toHaveURL(/\/first-login$/);
    await expect(fac.getByRole("button", { name: /Continue with current password/ })).toBeVisible();
    await ctx.close();
  });

  test("creates many accounts from a staff list and emails each person their login", async ({ page, browser }) => {
    await page.goto("/admin/users");
    const csv = [
      "Full name,Email,Role,Username",
      "Bulk One,bulk.one@gmail.com,Faculty,",
      "Bulk Two,bulk.two@gmail.com,Head of Department,bulk.two.hod",
      "No Email,,Faculty,",
      "Too Senior,senior@gmail.com,Administrator,",
    ].join("\n");
    const since = Date.now();
    await page.getByLabel("Staff list file").setInputFiles({ name: "staff.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf-8") });
    await expect(page.getByTestId("bulk-summary")).toContainText("2 ready to create");
    await expect(page.getByRole("table", { name: "People to create" })).toContainText("You can't create Administrator accounts");
    await page.getByRole("button", { name: "Create 2 accounts & email details" }).click();
    await expect(page.getByTestId("bulk-result")).toContainText("Created 2 accounts and emailed 2");
    await expect(page.getByTestId("user-row-bulk.one")).toContainText("Awaiting first sign-in");
    await expect(page.getByTestId("user-row-bulk.two.hod")).toContainText("Head of Department");

    // The emailed password really works.
    const password = await waitForMailField("bulk.one@gmail.com", since, "Initial password");
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const p2 = await ctx.newPage();
    await signIn(p2, "bulk.one@gmail.com", password, "Faculty");
    await expect(p2).toHaveURL(/\/first-login$/);
    await ctx.close();
  });

  test("cannot change their own role or manage administrators", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByTestId("user-row-e2e.admin").getByRole("button")).toHaveCount(0);
    await expect(page.getByTestId("user-row-e2e.admin").locator("select")).toHaveCount(0);
    await expect(page.getByTestId("user-row-admin123").getByRole("button")).toHaveCount(0);
    await expect(page.getByTestId("user-row-createradmin123").getByRole("button")).toHaveCount(0);
  });
});

test.describe.serial("initial accounts", () => {
  test("Creator Admin signs in with the env password, registers a Gmail, and gets full access", async ({ page }) => {
    await signIn(page, "createradmin123", E2E.creatorInitialPassword, "Creator Admin");
    await completeFirstLogin(page, "vishvag.creator@gmail.com", "Creator-Chosen-2026");
    await expect(page.getByTestId("profile-role")).toHaveText("Creator Admin");
    await expect(nav(page).locator('a[href="/admin/users"]')).toHaveCount(1);
    await page.goto("/admin/users");
    await expect(page.getByRole("combobox", { name: "Role", exact: true }).locator("option")).toHaveText(["Administrator", "Head of Department", "Faculty"]);

    // The initial password no longer works; the new one does.
    // Leave the app first so in-flight requests don't 401-redirect mid-navigation.
    await page.goto("about:blank");
    await page.context().clearCookies();
    await signIn(page, "createradmin123", E2E.creatorInitialPassword, "Creator Admin");
    await expect(formAlert(page)).toHaveText("Incorrect username or password.");
    await signIn(page, "vishvag.creator@gmail.com", "Creator-Chosen-2026", "Creator Admin");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("Administrator initial account can also finish first login and reset a forgotten password", async ({ page }) => {
    await signIn(page, "admin123", E2E.administratorInitialPassword, "Administrator");
    await completeFirstLogin(page, "college.admin@gmail.com", "Admin-Chosen-2026");
    await expect(page.getByTestId("profile-role")).toHaveText("Administrator");

    // Leave the app first so in-flight requests don't 401-redirect mid-navigation.
    await page.goto("about:blank");
    await page.context().clearCookies();
    await page.goto("/forgot-password");
    const since = Date.now();
    await page.getByLabel("Account email").fill("college.admin@gmail.com");
    await page.getByRole("button", { name: /Send verification code/ }).click();
    await expect(page.getByText(/If that email belongs to an InsightChart account/)).toBeVisible();
    await page.getByLabel("6-digit code").fill(await waitForOtp("college.admin@gmail.com", since));
    await page.getByRole("button", { name: "Verify code" }).click();
    await page.getByLabel("New password", { exact: true }).fill("Admin-Reset-2027");
    await page.getByLabel("Confirm new password", { exact: true }).fill("Admin-Reset-2027");
    await page.getByRole("button", { name: "Reset password" }).click();
    await page.getByRole("link", { name: "Continue to sign in" }).click();
    await signIn(page, "admin123", "Admin-Reset-2027", "Administrator");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
