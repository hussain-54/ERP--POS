import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config, supabaseConfigured } from "../config.js";

export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createAnonClient(): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Server-only client — never expose SUPABASE_SERVICE_ROLE_KEY to the web app. */
export function createServiceClient(): SupabaseClient | null {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) return null;
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getConnectionStatus(): {
  configured: boolean;
  urlHost: string | null;
} {
  if (!supabaseConfigured()) {
    return { configured: false, urlHost: null };
  }
  try {
    return { configured: true, urlHost: new URL(config.supabaseUrl).host };
  } catch {
    return { configured: false, urlHost: null };
  }
}
