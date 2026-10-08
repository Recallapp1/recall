import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite (e2e/): the real app against a throwaway in-memory
 * database (scripts/e2e-db.ts). No Neon, no Retell, no e-mail leaves.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const DB_PORT = Number(process.env.E2E_DB_PORT ?? 5544);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // One database: tests run one after another.
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure", locale: "tr-TR", timezoneId: "Europe/Istanbul" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "e2e",
      testMatch: /.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm exec tsx scripts/e2e-db.ts",
      port: DB_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { E2E_DB_PORT: String(DB_PORT) },
    },
    {
      // Production build: what we ship, and steadier than the dev server.
      command: `pnpm exec next build && pnpm exec next start --port ${PORT}`,
      url: `${baseURL}/api/health`,
      reuseExistingServer: false,
      timeout: 600_000,
      env: {
        DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`,
        DATABASE_POOL_MAX: "1",
        APP_URL: baseURL,
        BETTER_AUTH_URL: baseURL,
        BETTER_AUTH_SECRET: "e2e-only-secret-not-used-anywhere-0123456789",
        EMAIL_PROVIDER: "console",
        RETELL_API_KEY: "",
        SMS_PROVIDER: "console",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
