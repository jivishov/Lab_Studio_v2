import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    ssr: "server/learning/entry.ts",
    outDir: "dist-server/learning",
    emptyOutDir: true,
    target: "node24",
    rollupOptions: {
      output: { entryFileNames: "server.mjs" },
    },
  },
});
