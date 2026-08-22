/**
 * Bundle Express API into a single CJS file for Vercel serverless.
 * Avoids broken relative imports of apps/api/dist + workspace packages at runtime.
 *
 * On Vercel (VERCEL=1): writes directly to api/index.js (tracked entry) so the
 * function package does not depend on a gitignored includeFiles sidecar.
 * Locally: writes api/handler.cjs and leaves the thin api/index.js stub in place.
 *
 * Critical: esbuild CJS wraps ESM `export default` as `{ default: fn }`.
 * Vercel requires `module.exports` to be the request handler function itself.
 */
const { build } = require("esbuild");
const path = require("path");
const fs = require("fs");

const STUB = `/**
 * Vercel Node serverless entry (CJS).
 * Local: loads api/handler.cjs from \`npm run build:vercel\` / bundle script.
 * On Vercel: this file is replaced by the full esbuild bundle (VERCEL=1).
 */
const loaded = require("./handler.cjs");
module.exports = typeof loaded === "function" ? loaded : loaded.default;
`;

async function main() {
  const root = path.resolve(__dirname, "..");
  const entry = path.join(root, "apps/api/src/vercel-entry.ts");
  const onVercel = process.env.VERCEL === "1";
  const outfile = path.join(root, onVercel ? "api/index.js" : "api/handler.cjs");

  fs.mkdirSync(path.dirname(outfile), { recursive: true });

  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    sourcemap: false,
    logLevel: "info",
    external: ["bufferutil", "utf-8-validate"],
    banner: {
      js: "/* electronic-erp vercel api bundle */",
    },
    // Unwrap ESM default export so Vercel gets a callable handler.
    footer: {
      js: "\nmodule.exports = module.exports.default || module.exports;\n",
    },
  });

  const legacyMjs = path.join(root, "api/index.mjs");
  if (fs.existsSync(legacyMjs)) fs.unlinkSync(legacyMjs);

  if (onVercel) {
    const legacyHandler = path.join(root, "api/handler.cjs");
    if (fs.existsSync(legacyHandler)) fs.unlinkSync(legacyHandler);
  } else {
    fs.writeFileSync(path.join(root, "api/index.js"), STUB, "utf8");
  }

  console.log("[bundle-vercel-api] wrote", outfile, onVercel ? "(vercel entry)" : "(local sidecar)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
