/**
 * Single Vercel build orchestrator — always ends with process.exit so the
 * platform does not hang for 45 minutes waiting on open Node handles.
 */
const { execSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");

function run(cmd, env = {}) {
  console.log("[build-vercel]", cmd);
  execSync(cmd, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
}

try {
  run("npm run build:packages");
  // Same-origin API on Vercel — do not bake localhost into the web bundle.
  run("npm run build --prefix apps/web", { VITE_API_URL: "" });
  run("node scripts/emit-vercel-output.cjs");
  console.log("[build-vercel] done");
  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
