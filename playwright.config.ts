import { defineConfig, devices } from "@playwright/test";
import { E2E, storageStatePath } from "./e2e/fixtures";

// Runs against a production build (`npm run test:e2e` builds first) on its own port,
// database, and capture-only SMTP server — see e2e/server.ts. The dataset and accounts
// are shared server state now, so specs run one at a time.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${E2E.port}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx tsx e2e/server.ts",
    url: `http://localhost:${E2E.port}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      testMatch: /smoke\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: storageStatePath("admin") },
    },
    {
      name: "roles",
      testMatch: /roles\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
