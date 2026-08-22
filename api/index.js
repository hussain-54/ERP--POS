/**
 * Vercel Node serverless entry (CJS).
 * Local: loads api/handler.cjs from the bundle/emit scripts.
 * Production deploy uses Build Output API (`.vercel/output`) from emit-vercel-output.cjs.
 */
const loaded = require("./handler.cjs");
module.exports = typeof loaded === "function" ? loaded : loaded.default;
