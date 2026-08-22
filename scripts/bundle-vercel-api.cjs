/**
 * Bundle Express API into a single CJS file for Vercel serverless.
 * Avoids broken relative imports of apps/api/dist + workspace packages at runtime.
 */
const { build } = require("esbuild");
const path = require("path");
const fs = require("fs");

async function main() {
  const root = path.resolve(__dirname, "..");
  const entry = path.join(root, "apps/api/src/vercel-entry.ts");
  const outfile = path.join(root, "api/handler.cjs");

  fs.mkdirSync(path.dirname(outfile), { recursive: true });

  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    target: "node24",
    format: "cjs",
    sourcemap: false,
    logLevel: "info",
    // Keep dotenv optional; Vercel injects env at runtime
    external: [],
    // packages that break when bundled (none expected for API)
    banner: {
      js: "/* electronic-erp vercel api bundle */",
    },
  });

  // Drop ESM entry if present — CJS index.js is the Vercel target
  const legacy = path.join(root, "api/index.mjs");
  if (fs.existsSync(legacy)) fs.unlinkSync(legacy);

  console.log("[bundle-vercel-api] wrote", outfile);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
