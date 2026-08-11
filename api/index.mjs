/**
 * Vercel serverless entry — mounts the Express API on the same deployment as the web app.
 * Requests to /api/* and /health* are rewritten here (see vercel.json).
 */
import { createApp } from "../apps/api/dist/app.js";

const app = createApp();

export default app;
