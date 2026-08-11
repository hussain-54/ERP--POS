const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

fs.mkdirSync(dist, { recursive: true });
fs.copyFileSync(path.join(root, "preload.cjs"), path.join(dist, "preload.cjs"));

console.log("[desktop] copied preload.cjs → dist/preload.cjs");
