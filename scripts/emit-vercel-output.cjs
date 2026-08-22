/**
 * Produce Vercel Build Output API layout so the platform does not re-trace /
 * re-bundle the prebuilt Express handler (that step was hanging ~45m then Error).
 *
 * Layout:
 *   .vercel/output/static     ← apps/web/dist
 *   .vercel/output/functions/api.func/index.js  ← Express CJS bundle
 *   .vercel/output/config.json
 */
const { build } = require("esbuild");
const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");
const outRoot = path.join(root, ".vercel", "output");
const staticDir = path.join(outRoot, "static");
const funcDir = path.join(outRoot, "functions", "api.func");

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

async function bundleApi(outfile) {
  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  await build({
    entryPoints: [path.join(root, "apps/api/src/vercel-entry.ts")],
    outfile,
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    sourcemap: false,
    logLevel: "info",
    // Optional ws natives — leave unresolved; safe no-ops at runtime.
    external: ["bufferutil", "utf-8-validate"],
    banner: { js: "/* electronic-erp vercel api bundle */" },
    footer: {
      js: "\nmodule.exports = module.exports.default || module.exports;\n",
    },
  });
}

async function main() {
  const webDist = path.join(root, "apps/web/dist");
  if (!fs.existsSync(path.join(webDist, "index.html"))) {
    throw new Error("apps/web/dist missing — run web build before emit-vercel-output");
  }

  rmrf(outRoot);
  fs.mkdirSync(outRoot, { recursive: true });

  copyDir(webDist, staticDir);

  await bundleApi(path.join(funcDir, "index.js"));
  fs.writeFileSync(
    path.join(funcDir, ".vc-config.json"),
    JSON.stringify(
      {
        runtime: "nodejs20.x",
        handler: "index.js",
        launcherType: "Nodejs",
        shouldAddHelpers: true,
        maxDuration: 30,
      },
      null,
      2,
    ),
    "utf8",
  );

  // Also keep api/index.js in sync for local/debug (thin stub → sidecar).
  const localHandler = path.join(root, "api/handler.cjs");
  fs.copyFileSync(path.join(funcDir, "index.js"), localHandler);
  fs.writeFileSync(
    path.join(root, "api/index.js"),
    `const loaded = require("./handler.cjs");\nmodule.exports = typeof loaded === "function" ? loaded : loaded.default;\n`,
    "utf8",
  );

  const config = {
    version: 3,
    routes: [
      { src: "^/health(?:/(.*))?$", dest: "/api" },
      { src: "^/api(?:/(.*))$", dest: "/api" },
      { handle: "filesystem" },
      { src: "/(.*)", dest: "/index.html" },
    ],
  };
  fs.writeFileSync(path.join(outRoot, "config.json"), JSON.stringify(config, null, 2), "utf8");

  console.log("[emit-vercel-output] wrote", outRoot);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
