import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const packages = path.resolve(__dirname, "../../packages");

/**
 * Vercel waits for the build process to exit. Vite can leave open handles
 * (watchers / native deps) so the deploy stays "Building" until the 45m limit.
 * @see https://vercel.com/kb/guide/fixing-deployments-that-hang-after-the-build-step-succeeds
 */
function forceExitOnVercel(): Plugin {
  return {
    name: "force-exit-on-vercel",
    apply: "build",
    closeBundle() {
      if (process.env.VERCEL !== "1" && process.env.CI !== "1") return;
      // Defer so Vite can flush logs, then terminate the Node process.
      setTimeout(() => process.exit(0), 0);
    },
  };
}

export default defineConfig({
  plugins: [react(), forceExitOnVercel()],
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
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
