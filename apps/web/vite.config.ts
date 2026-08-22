import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const packages = path.resolve(__dirname, "../../packages");

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, "../.."),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@electronic-erp/contracts": path.resolve(packages, "contracts/src/index.ts"),
      "@electronic-erp/domain": path.resolve(packages, "domain/src/index.ts"),
      "@electronic-erp/db": path.resolve(packages, "db/src/index.ts"),
      "@electronic-erp/hardware": path.resolve(packages, "hardware/src/index.ts"),
      "@electronic-erp/ui": path.resolve(packages, "ui/src/index.ts"),
      "@electronic-erp/ui/styles.css": path.resolve(packages, "ui/src/styles.css"),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // ERP + POS share one entry; ~1–1.5 MB is expected until routes are code-split.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
