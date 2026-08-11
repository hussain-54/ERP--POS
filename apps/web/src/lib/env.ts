export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
};

export function isSupabaseConfigured(): boolean {
  return Boolean(
    env.supabaseUrl &&
      env.supabaseAnonKey &&
      !String(env.supabaseUrl).includes("your-project"),
  );
}
