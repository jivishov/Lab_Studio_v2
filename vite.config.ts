import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    // The isolated Three.js prototype route is just over Vite's default 500 kB limit.
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: "jsdom",
    globals: true,
    pool: "threads",
    setupFiles: ["./src/test/setup.ts"],
    // Keep Vitest's maintained surfaces explicit. Playwright's `tests/*.e2e.ts` remains owned by
    // the Playwright command, while scripts and server tests are intentional Vitest categories.
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "server/**/*.{test,spec}.{ts,tsx}",
      "scripts/**/*.{test,spec}.{js,mjs}",
    ],
    exclude: [
      ...configDefaults.exclude,
      "**/Refined_Implementation_Plan_2026-07-18/**",
      "**/Lab_Studio_Assay_Causalyst_Refined_Implementation_Plan_2026-07-18/**",
    ],
  },
});
