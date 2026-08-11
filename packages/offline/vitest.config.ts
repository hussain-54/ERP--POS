import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@electronic-erp/contracts": path.resolve(__dirname, "../contracts/src/index.ts"),
      "@electronic-erp/domain": path.resolve(__dirname, "../domain/src/index.ts"),
      "@electronic-erp/sync": path.resolve(__dirname, "../sync/src/index.ts"),
    },
  },
});
