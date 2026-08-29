import type { AuthSession, LoginInput, SignupInput, UserProfile } from "@electronic-erp/contracts";
import { DEFAULT_PASSWORD_POLICY } from "@electronic-erp/domain";
import { apiFetch, ApiError } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import { emitSessionExpired, emitSessionTokensUpdated } from "./session-events";

const TOKEN_KEY = "erp.accessToken";
const REFRESH_KEY = "erp.refreshToken";
const BRANCH_KEY = "erp.branchId";
const ACTIVITY_KEY = "erp.auth.lastActivityAt";

/** Refresh when access JWT expires within this window. */
const REFRESH_SKEW_MS = 90_000;
/** Inactivity timeout — aligns with domain password/session policy (hours). */
const INACTIVITY_MS = Math.max(1, DEFAULT_PASSWORD_POLICY.sessionTtlHours) * 60 * 60 * 1000;

export const authStorage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string | null) {
    if (!token) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  },
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  setRefreshToken(token: string | null) {
    if (!token) localStorage.removeItem(REFRESH_KEY);
    else localStorage.setItem(REFRESH_KEY, token);
  },
  getBranchId(): string | null {
    return localStorage.getItem(BRANCH_KEY);
  },
  setBranchId(branchId: string | null) {
    if (!branchId) localStorage.removeItem(BRANCH_KEY);
    else localStorage.setItem(BRANCH_KEY, branchId);
  },
  getLastActivityAt(): number | null {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  },
  touchActivity(at = Date.now()) {
    localStorage.setItem(ACTIVITY_KEY, String(at));
  },
  clearActivity() {
    localStorage.removeItem(ACTIVITY_KEY);
  },
};

function mapUserProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    authUserId: String(row.auth_user_id),
    organizationId: String(row.organization_id),
    email: String(row.email),
    fullName: String(row.full_name),
    phone: (row.phone as string | null) ?? null,
    isActive: Boolean(row.is_active),
    defaultBranchId: (row.default_branch_id as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdBy: (row.created_by as string | null) ?? null,
    updatedBy: (row.updated_by as string | null) ?? null,
    deletedAt: (row.deleted_at as string | null) ?? null,
    version: Number(row.version ?? 1),
  };
}

function jwtExpiresAtMs(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function accessTokenNeedsRefresh(token: string | null, skewMs = REFRESH_SKEW_MS): boolean {
  if (!token) return true;
  const exp = jwtExpiresAtMs(token);
  if (exp == null) return false;
  return exp - Date.now() <= skewMs;
}

function syncTokensFromSupabaseSession(session: {
  access_token: string;
  refresh_token?: string | null;
}): void {
  authStorage.setToken(session.access_token);
  if (session.refresh_token) authStorage.setRefreshToken(session.refresh_token);
  emitSessionTokensUpdated();
}

function persistSession(session: AuthSession, refreshToken?: string | null) {
  authStorage.setToken(session.accessToken);
  const refresh = refreshToken ?? session.refreshToken ?? authStorage.getRefreshToken();
  if (refresh) authStorage.setRefreshToken(refresh);
  if (session.user.defaultBranchId) {
    authStorage.setBranchId(session.user.defaultBranchId);
  } else if (session.branches[0]) {
    authStorage.setBranchId(session.branches[0]);
  }
  authStorage.touchActivity();
}

async function hydrateProfile(accessToken: string): Promise<AuthSession> {
  const sb = getSupabase();
  const { data: userData, error: userErr } = await sb.auth.getUser(accessToken);
  if (userErr || !userData.user) {
    throw new Error(userErr?.message ?? "Invalid session");
  }

  const { data: profileRow, error: profileErr } = await sb
    .from("user_profiles")
    .select("*")
    .eq("auth_user_id", userData.user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (profileErr) throw new Error(profileErr.message);
  if (!profileRow) {
    throw new Error("User profile not found. Run bootstrap_first_owner.sql in Supabase.");
  }

  const profile = mapUserProfile(profileRow as Record<string, unknown>);

  const [{ data: branches, error: branchErr }, { data: perms, error: permErr }] = await Promise.all([
    sb.from("branch_memberships").select("branch_id").eq("user_id", profile.id),
    sb.rpc("get_user_permission_keys", { p_user_id: profile.id }),
  ]);

  if (branchErr) throw new Error(branchErr.message);
  if (permErr && !String(permErr.message).includes("get_user_permission_keys")) {
    throw new Error(permErr.message);
  }

  return {
    accessToken,
    refreshToken: authStorage.getRefreshToken() ?? undefined,
    user: profile,
    permissions: (perms as string[] | null) ?? [],
    branches: (branches ?? []).map((b) => String(b.branch_id)),
  };
}

let refreshInFlight: Promise<string | null> | null = null;
let authListenerBound = false;

/**
 * Ensure `erp.accessToken` is valid for API Bearer calls.
 * Uses Supabase session / refresh token — never clears POS cart state.
 */
export async function ensureFreshAccessToken(options?: {
  force?: boolean;
}): Promise<string | null> {
  const current = authStorage.getToken();
  if (!options?.force && current && !accessTokenNeedsRefresh(current)) {
    return current;
  }

  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      if (isSupabaseConfigured()) {
        const sb = getSupabase();
        const { data: existing } = await sb.auth.getSession();
        if (existing.session?.access_token) {
          if (!options?.force && !accessTokenNeedsRefresh(existing.session.access_token)) {
            syncTokensFromSupabaseSession(existing.session);
            return existing.session.access_token;
          }
          const { data, error } = await sb.auth.refreshSession();
          if (!error && data.session?.access_token) {
            syncTokensFromSupabaseSession(data.session);
            return data.session.access_token;
          }
        }

        const refresh = authStorage.getRefreshToken();
        if (refresh) {
          const { data, error } = await sb.auth.refreshSession({ refresh_token: refresh });
          if (!error && data.session?.access_token) {
            syncTokensFromSupabaseSession(data.session);
            return data.session.access_token;
          }
        }

        // Access token may still be valid even if refresh path failed.
        if (current && !accessTokenNeedsRefresh(current, 0)) {
          return current;
        }
        return null;
      }

      return current;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function clearLocalAuth() {
  authStorage.setToken(null);
  authStorage.setRefreshToken(null);
  authStorage.clearActivity();
}

/** Bind once: keep erp.* tokens in sync with Supabase auto-refresh. */
export function bindAuthLifecycle(): () => void {
  if (!isSupabaseConfigured() || authListenerBound || typeof window === "undefined") {
    return () => undefined;
  }
  authListenerBound = true;
  const sb = getSupabase();
  const { data } = sb.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
      if (session?.access_token) {
        syncTokensFromSupabaseSession(session);
      }
      return;
    }
    if (event === "SIGNED_OUT") {
      // Explicit logout already clears; ignore if we still have tokens mid-refresh race.
      if (!authStorage.getToken() && !authStorage.getRefreshToken()) return;
    }
  });

  return () => {
    data.subscription.unsubscribe();
    authListenerBound = false;
  };
}

export function isInactivityTimedOut(): boolean {
  const last = authStorage.getLastActivityAt();
  if (!last) return false;
  return Date.now() - last > INACTIVITY_MS;
}

export function noteUserActivity(): void {
  if (!authStorage.getToken()) return;
  authStorage.touchActivity();
}

export const INACTIVITY_TIMEOUT_MS = INACTIVITY_MS;

/** Auth orchestration lives outside React components. */
export const authService = {
  async signup(input: SignupInput): Promise<AuthSession> {
    const session = await apiFetch<AuthSession>("/api/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify(input),
      skipAuthRefresh: true,
    });
    if (isSupabaseConfigured() && session.accessToken) {
      syncTokensFromSupabaseSession({
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
      });
    }
    persistSession(session, session.refreshToken);
    return session;
  },

  async login(input: LoginInput): Promise<AuthSession> {
    if (isSupabaseConfigured()) {
      const sb = getSupabase();
      const { data, error } = await sb.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      if (error || !data.session || !data.user) {
        throw new Error(error?.message ?? "Login failed");
      }

      syncTokensFromSupabaseSession(data.session);

      try {
        const session = await apiFetch<AuthSession>("/api/v1/auth/session", {
          token: data.session.access_token,
          skipAuthRefresh: true,
        });
        persistSession(session, data.session.refresh_token);
        return { ...session, refreshToken: data.session.refresh_token };
      } catch (apiErr) {
        void apiErr;
        const session = await hydrateProfile(data.session.access_token);
        persistSession(session, data.session.refresh_token);
        return session;
      }
    }

    const session = await apiFetch<AuthSession>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
      skipAuthRefresh: true,
    });
    persistSession(session, session.refreshToken);
    return session;
  },

  async logout(): Promise<void> {
    const token = authStorage.getToken();
    if (token) {
      try {
        await apiFetch("/api/v1/auth/logout", {
          method: "POST",
          token,
          skipAuthRefresh: true,
        });
      } catch {
        // still clear local session
      }
    }
    if (isSupabaseConfigured()) {
      try {
        await getSupabase().auth.signOut();
      } catch {
        // ignore
      }
    }
    clearLocalAuth();
  },

  async restore(): Promise<AuthSession | null> {
    if (isInactivityTimedOut()) {
      clearLocalAuth();
      emitSessionExpired("inactivity");
      return null;
    }

    const fresh = await ensureFreshAccessToken();
    const token = fresh ?? authStorage.getToken();
    if (!token) return null;

    try {
      const session = await apiFetch<AuthSession>("/api/v1/auth/session", {
        token,
        skipAuthRefresh: true,
      });
      persistSession(session);
      return session;
    } catch (err) {
      if (isSupabaseConfigured()) {
        try {
          const retried = await ensureFreshAccessToken({ force: true });
          if (retried) {
            try {
              const session = await apiFetch<AuthSession>("/api/v1/auth/session", {
                token: retried,
                skipAuthRefresh: true,
              });
              persistSession(session);
              return session;
            } catch {
              const hydrated = await hydrateProfile(retried);
              persistSession(hydrated);
              return hydrated;
            }
          }
        } catch {
          // fall through
        }
      }

      const unauthorized =
        err instanceof ApiError ? err.status === 401 : true;
      if (unauthorized) {
        clearLocalAuth();
      }
      return null;
    }
  },

  /**
   * Called when an API request gets 401. Refreshes once; if still invalid, expires session.
   * Returns a new access token or null.
   */
  async handleUnauthorized(): Promise<string | null> {
    const next = await ensureFreshAccessToken({ force: true });
    if (next) return next;
    clearLocalAuth();
    emitSessionExpired("expired");
    return null;
  },

  async requestPasswordReset(email: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const sb = getSupabase();
      const redirectTo = `${window.location.origin}/auth/reset`;
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw new Error(error.message);
      return;
    }
    await apiFetch("/api/v1/auth/password-reset", {
      method: "POST",
      body: JSON.stringify({ email }),
      skipAuthRefresh: true,
    });
  },

  async me(token: string) {
    return apiFetch<{
      user: AuthSession["user"];
      permissions: string[];
      branches: string[];
      organizationId: string;
      branchId: string | null;
    }>("/api/v1/auth/me", { token, skipAuthRefresh: true });
  },

  forceSessionExpired(reason: "expired" | "invalid" | "inactivity" = "expired") {
    clearLocalAuth();
    emitSessionExpired(reason);
  },
};
