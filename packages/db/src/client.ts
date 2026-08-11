import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type DatabaseClient = SupabaseClient;

export interface SupabaseEnv {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export function createBrowserSupabaseClient(env: Pick<SupabaseEnv, "url" | "anonKey">): DatabaseClient {
  if (!env.url || !env.anonKey) {
    throw new Error("Supabase URL and anon key are required");
  }
  return createClient(env.url, env.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export function createServiceSupabaseClient(env: SupabaseEnv): DatabaseClient {
  const key = env.serviceRoleKey ?? env.anonKey;
  if (!env.url || !key) {
    throw new Error("Supabase URL and key are required");
  }
  return createClient(env.url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function isSupabaseConfigured(env: Partial<SupabaseEnv>): boolean {
  return Boolean(env.url && env.anonKey && !env.url.includes("your-project"));
}
