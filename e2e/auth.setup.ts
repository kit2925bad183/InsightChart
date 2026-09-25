import { test as setup, expect } from "@playwright/test";
import { E2E, storageStatePath } from "./fixtures";

// Signs each pre-activated role in once and saves the session for the other specs.
for (const u of E2E.activeUsers) {
  setup(`sign in as ${u.key}`, async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: new RegExp("^" + { admin: "Administrator", hod: "Head of Department", faculty: "Faculty" }[u.key]) }).click();
    await page.getByLabel("Username or email").fill(u.username);
    await page.getByLabel("Password", { exact: true }).fill(u.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("profile-name")).toHaveText(u.displayName);
    await page.context().storageState({ path: storageStatePath(u.key) });
  });
}
