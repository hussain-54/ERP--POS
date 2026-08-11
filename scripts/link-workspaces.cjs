/**
 * Create real package stubs and copy built dist (no symlinks/junctions).
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

const targets = [
  { name: "@electronic-erp/contracts", rel: "packages/contracts", hasCss: false },
  { name: "@electronic-erp/domain", rel: "packages/domain", hasCss: false },
  { name: "@electronic-erp/db", rel: "packages/db", hasCss: false },
  { name: "@electronic-erp/sync", rel: "packages/sync", hasCss: false },
  { name: "@electronic-erp/hardware", rel: "packages/hardware", hasCss: false },
  { name: "@electronic-erp/ai", rel: "packages/ai", hasCss: false },
  { name: "@electronic-erp/offline", rel: "packages/offline", hasCss: false },
  { name: "@electronic-erp/ui", rel: "packages/ui", hasCss: true },
  { name: "@electronic-erp/api", rel: "apps/api", hasCss: false },
  { name: "@electronic-erp/web", rel: "apps/web", hasCss: false },
];

const scopeDir = path.join(root, "node_modules", "@electronic-erp");
fs.mkdirSync(scopeDir, { recursive: true });

for (const target of targets) {
  const pkgDir = path.join(root, "node_modules", ...target.name.split("/"));
  fs.mkdirSync(pkgDir, { recursive: true });

  const distSrc = path.join(root, target.rel, "dist");
  const distDest = path.join(pkgDir, "dist");
  if (fs.existsSync(distSrc)) {
    fs.rmSync(distDest, { recursive: true, force: true });
    copyDir(distSrc, distDest);
  }

  if (target.hasCss) {
    const cssSrc = path.join(root, target.rel, "src", "styles.css");
    if (fs.existsSync(cssSrc)) {
      fs.mkdirSync(path.join(pkgDir, "src"), { recursive: true });
      fs.copyFileSync(cssSrc, path.join(pkgDir, "src", "styles.css"));
    }
  }

  const exportsField = {
    ".": {
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
      default: "./dist/index.js",
    },
  };
  if (target.hasCss) {
    exportsField["./styles.css"] = "./src/styles.css";
  }

  const pkgJson = {
    name: target.name,
    version: "0.1.0",
    private: true,
    type: "module",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: exportsField,
  };

  fs.writeFileSync(path.join(pkgDir, "package.json"), JSON.stringify(pkgJson, null, 2));
  console.log(`[link-workspaces] stubbed ${target.name}`);
}
