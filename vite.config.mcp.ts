import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    ssr: "server/mcp/entry.ts",
    outDir: "dist-server/mcp",
    emptyOutDir: true,
    target: "node22",
    rollupOptions: {
      output: {
        entryFileNames: "server.mjs",
      },
    },
  },
});
