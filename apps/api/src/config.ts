import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");

/** Load env files: base → environment-specific → process overrides. */
dotenv.config({ path: path.join(root, ".env") });
const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
dotenv.config({ path: path.join(root, `.env.${appEnv}`), override: true });
dotenv.config(); // allow local shell overrides

export type AppEnvironment = "development" | "staging" | "production";

function resolveAppEnv(): AppEnvironment {
  const raw = (process.env.APP_ENV ?? process.env.NODE_ENV ?? "development").toLowerCase();
  if (raw === "production" || raw === "staging" || raw === "development") return raw;
  return "development";
}

export const config = {
  /** Prefer API_PORT; fall back to PORT (Render/Railway/Fly) then 4000. */
  port: Number(process.env.API_PORT ?? process.env.PORT ?? 4000),
  corsOrigin: process.env.API_CORS_ORIGIN ?? "http://localhost:5173",
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey:
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  nodeEnv: process.env.NODE_ENV ?? "development",
  appEnv: resolveAppEnv(),
  logLevel: process.env.LOG_LEVEL ?? "info",
};

export function supabaseConfigured(): boolean {
  return Boolean(
    config.supabaseUrl &&
      config.supabaseAnonKey &&
      !config.supabaseUrl.includes("your-project"),
  );
}

/** Fail fast in staging/production when required secrets/config are missing. */
export function assertProductionConfig(): void {
  if (config.appEnv === "development") return;
  const missing: string[] = [];
  if (!config.supabaseUrl || config.supabaseUrl.includes("your-project")) {
    missing.push("SUPABASE_URL");
  }
  if (!config.supabaseAnonKey || config.supabaseAnonKey.includes("your-anon")) {
    missing.push("SUPABASE_ANON_KEY");
  }
  if (!config.supabaseServiceRoleKey || config.supabaseServiceRoleKey.includes("your-service")) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!process.env.API_CORS_ORIGIN) {
    missing.push("API_CORS_ORIGIN");
  }
  if (missing.length) {
    throw new Error(
      `[config] ${config.appEnv} requires env: ${missing.join(", ")}. Copy from .env.${config.appEnv}.example`,
    );
  }
  if (config.corsOrigin.includes("localhost") && config.appEnv === "production") {
    throw new Error("[config] production API_CORS_ORIGIN must not be localhost");
  }
}
