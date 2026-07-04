import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const env =
    "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-local-anon-key";
const webServer = process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
          command: `${env} npm run dev -- --hostname 127.0.0.1 --port ${port}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
      };

export default defineConfig({
    testDir: "./tests/e2e",
    timeout: 30_000,
    expect: {
        timeout: 10_000,
    },
    fullyParallel: true,
    reporter: [["list"]],
    use: {
        baseURL,
        trace: "retain-on-failure",
    },
    webServer,
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
});
