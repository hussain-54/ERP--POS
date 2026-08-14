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
  const srcDir = path.join(dir, "src");
  if (fs.existsSync(srcDir)) {
    for (const f of fs.readdirSync(srcDir)) {
      if (/\.(js|d\.ts|js\.map)$/.test(f)) rm(path.join(srcDir, f));
    }
  }
}

console.log("[clean-package-dists] cleared packages/*/dist and tsbuildinfo");
