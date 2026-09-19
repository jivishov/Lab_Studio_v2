import { defineConfig, devices } from "@playwright/test";

const smokeBaseURL = process.env.LAB_STUDIO_SMOKE_BASE_URL ?? "http://127.0.0.1:4180";
const useExistingSmokeServer = process.env.LAB_STUDIO_SMOKE_USE_EXISTING_SERVER === "true";

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.e2e\.ts/,
  timeout: 30_000,
  use: {
    baseURL: smokeBaseURL,
    trace: "retain-on-failure",
  },
  ...(useExistingSmokeServer
    ? {}
    : {
        webServer: {
          command: "npx vite preview --host 127.0.0.1 --port 4180 --strictPort",
          reuseExistingServer: false,
          url: smokeBaseURL,
        },
      }),
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
