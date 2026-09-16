import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.e2e\.ts/,
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4180",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx vite preview --host 127.0.0.1 --port 4180 --strictPort",
    reuseExistingServer: false,
    url: "http://127.0.0.1:4180",
  },
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
