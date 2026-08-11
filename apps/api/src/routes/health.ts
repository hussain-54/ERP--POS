import { Router } from "express";
import { getConnectionStatus } from "../lib/supabase.js";
import { createAnonClient } from "../lib/supabase.js";
import { supabaseConfigured } from "../config.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "electronic-erp-api",
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get("/health/supabase", async (_req, res) => {
  const status = getConnectionStatus();
  if (!status.configured) {
    res.status(503).json({
      ok: false,
      configured: false,
      message: "Supabase env vars not configured",
    });
    return;
  }

  try {
    const client = createAnonClient();
    // Lightweight auth settings probe
    const { error } = await client.auth.getSession();
    res.json({
      ok: !error,
      configured: true,
      host: status.urlHost,
      supabaseConfigured: supabaseConfigured(),
      message: error ? error.message : "Supabase client initialized",
    });
  } catch (err) {
    res.status(503).json({
      ok: false,
      configured: true,
      host: status.urlHost,
      message: err instanceof Error ? err.message : "Supabase probe failed",
    });
  }
});
