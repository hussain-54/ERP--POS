const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");
const checks = [];

function ok(label) {
  checks.push({ label, ok: true });
  console.log(`PASS  ${label}`);
}
function fail(label, detail) {
  checks.push({ label, ok: false, detail });
  console.log(`FAIL  ${label}: ${detail}`);
}

try {
  require.resolve("electron", { paths: [root, path.join(root, "../..")] });
  ok("electron dependency");
} catch (e) {
  fail("electron dependency", e.message);
}

try {
  require.resolve("better-sqlite3", { paths: [root, path.join(root, "../..")] });
  ok("better-sqlite3 dependency");
} catch (e) {
  fail("better-sqlite3 dependency", e.message);
}

try {
  require.resolve("electron-builder", { paths: [root, path.join(root, "../..")] });
  ok("electron-builder dependency");
} catch (e) {
  fail("electron-builder dependency", e.message);
}

try {
  require.resolve("electron-updater", { paths: [root, path.join(root, "../..")] });
  ok("electron-updater dependency");
} catch (e) {
  fail("electron-updater dependency", e.message);
}

if (fs.existsSync(path.join(root, "src", "main.ts"))) ok("main process source");
else fail("main process source", "missing src/main.ts");

if (fs.existsSync(path.join(root, "preload.cjs"))) ok("preload bridge");
else fail("preload bridge", "missing preload.cjs");

if (fs.existsSync(path.join(root, "renderer", "index.html"))) ok("renderer shell");
else fail("renderer shell", "missing renderer/index.html");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (pkg.build?.nsis?.deleteAppDataOnUninstall === false) {
  ok("NSIS preserves AppData on uninstall");
} else {
  fail("NSIS preserves AppData on uninstall", "deleteAppDataOnUninstall must be false");
}

const failed = checks.filter((c) => !c.ok);
console.log(
  JSON.stringify(
    {
      app: "electronic-erp-desktop",
      ready: failed.length === 0,
      version: pkg.version,
      failed: failed.map((f) => f.label),
    },
    null,
    2,
  ),
);
process.exit(failed.length ? 1 : 0);
