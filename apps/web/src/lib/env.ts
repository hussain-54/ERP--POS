/** Resolve API base URL. Production on Vercel uses same-origin `/api/v1` (empty base). */
function resolveApiUrl(): string {
  const raw = String(import.meta.env.VITE_API_URL ?? "").trim().replace(/\/$/, "");
  if (import.meta.env.PROD) {
    // Misconfigs that must never be used from a Vercel/browser bundle
    if (
      !raw ||
      /localhost|127\.0\.0\.1/i.test(raw) ||
      /api\.example\.com/i.test(raw) ||
      /your-api|example\.com/i.test(raw)
    ) {
      return "";
    }
    return raw;
  }
  return raw || "http://localhost:4000";
}

export const env = {
  apiUrl: resolveApiUrl(),
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "",
  // Prefer anon key; accept publishable alias from Phase 19 / Supabase docs
  supabaseAnonKey:
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "",
};

export function isSupabaseConfigured(): boolean {
  return Boolean(
    env.supabaseUrl &&
      env.supabaseAnonKey &&
      !String(env.supabaseUrl).includes("your-project"),
  );
}
