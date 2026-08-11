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
    supabaseConfigured: supabaseConfigured(),
    env: {
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      hasAnonOrPublishable: Boolean(
        process.env.SUPABASE_ANON_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          process.env.SUPABASE_PUBLISHABLE_KEY,
      ),
      hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      onVercel: process.env.VERCEL === "1",
    },
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
