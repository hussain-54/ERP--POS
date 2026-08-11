import { createBrowserSupabaseClient } from "@electronic-erp/db";
import { env, isSupabaseConfigured } from "./env";

let client: ReturnType<typeof createBrowserSupabaseClient> | null = null;

export function getSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
  if (!client) {
    client = createBrowserSupabaseClient({
      url: env.supabaseUrl,
      anonKey: env.supabaseAnonKey,
    });
  }
  return client;
}
