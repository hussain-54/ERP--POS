/**
 * Vercel Node serverless entry (CJS).
 * Local: loads api/handler.cjs from `npm run build:vercel` / bundle script.
 * On Vercel: this file is replaced by the full esbuild bundle (VERCEL=1).
 */
const loaded = require("./handler.cjs");
module.exports = typeof loaded === "function" ? loaded : loaded.default;
