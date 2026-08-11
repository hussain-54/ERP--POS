export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
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
