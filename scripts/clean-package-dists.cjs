/**
 * Remove package dist/ and tsbuildinfo so Vercel/Linux never trusts stale Windows incremental state.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packagesRoot = path.join(root, "packages");

function rm(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

for (const name of fs.readdirSync(packagesRoot)) {
  const dir = path.join(packagesRoot, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  rm(path.join(dir, "dist"));
  rm(path.join(dir, "tsconfig.tsbuildinfo"));
}

console.log("[clean-package-dists] cleared packages/*/dist and tsbuildinfo");
