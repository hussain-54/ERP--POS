/**
 * Vercel Node serverless entry (CJS).
 * The Express app is pre-bundled into handler.cjs during `npm run build:vercel`.
 */
try {
  module.exports = require("./handler.cjs");
} catch (err) {
  module.exports = (req, res) => {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        error: "API handler failed to load",
        detail: message,
      }),
    );
  };
}
