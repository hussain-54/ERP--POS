import express from "express";
import cors, { type CorsOptions } from "cors";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { inventoryRouter } from "./routes/inventory.js";
import { partiesRouter } from "./routes/parties.js";
import { posRouter } from "./routes/pos.js";
import { purchasesRouter } from "./routes/purchases.js";
import { afterSalesRouter } from "./routes/after-sales.js";
import { accountingRouter } from "./routes/accounting.js";
import { adminRouter } from "./routes/admin.js";
import { syncRouter } from "./routes/sync.js";
import { hardwareRouter } from "./routes/hardware.js";
import { reportsRouter } from "./routes/reports.js";
import { commerceRouter } from "./routes/commerce.js";
import { aiRouter } from "./routes/ai.js";
import { enterpriseRouter } from "./routes/enterprise.js";
import { infrastructureRouter } from "./routes/infrastructure.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requireAuth, type AuthedRequest } from "./middleware/auth.js";
import { log } from "./lib/logger.js";

function resolveCorsOrigin(): CorsOptions["origin"] {
  const configured = config.corsOrigin
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = new Set(configured);
  if (process.env.VERCEL_URL) {
    allowed.add(`https://${process.env.VERCEL_URL}`);
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    allowed.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  return (origin, callback) => {
    // Same-origin / non-browser / serverless probe
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowed.has("*") || allowed.has(origin)) {
      callback(null, true);
      return;
    }
    try {
      const host = new URL(origin).hostname;
      // Preview + production *.vercel.app when API is co-hosted
      if (host.endsWith(".vercel.app") || process.env.VERCEL === "1") {
        callback(null, true);
        return;
      }
    } catch {
      // fall through
    }
    callback(null, false);
  };
}

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: resolveCorsOrigin(),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "8mb" }));
  app.use((req, _res, next) => {
    if (!req.headers["x-request-id"]) {
      req.headers["x-request-id"] = randomUUID();
    }
    next();
  });
  app.use((req, res, next) => {
    const started = Date.now();
    res.on("finish", () => {
      if (req.path === "/health" || req.path.startsWith("/health")) return;
      log.info({
        category: "api",
        message: "request",
        requestId: String(req.headers["x-request-id"] ?? ""),
        meta: {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Date.now() - started,
        },
      });
    });
    next();
  });

  app.use(healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/catalog", catalogRouter);
  app.use("/api/v1/inventory", inventoryRouter);
  app.use("/api/v1/parties", partiesRouter);
  app.use("/api/v1/pos", posRouter);
  app.use("/api/v1/purchases", purchasesRouter);
  app.use("/api/v1/after-sales", afterSalesRouter);
  app.use("/api/v1/accounting", accountingRouter);
  app.use("/api/v1/admin", adminRouter);
  app.use("/api/v1/sync", syncRouter);
  app.use("/api/v1/hardware", hardwareRouter);
  app.use("/api/v1/reports", reportsRouter);
  app.use("/api/v1", commerceRouter);
  app.use("/api/v1", aiRouter);
  app.use("/api/v1", enterpriseRouter);
  app.use("/api/v1", infrastructureRouter);

  app.get("/api/v1/protected/ping", requireAuth, (req: AuthedRequest, res) => {
    res.json({
      ok: true,
      userId: req.profile?.id,
      organizationId: req.authz?.organizationId,
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
