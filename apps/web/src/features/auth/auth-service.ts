import type { AuthSession, LoginInput, UserProfile } from "@electronic-erp/contracts";
import { apiFetch } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";

const TOKEN_KEY = "erp.accessToken";
const REFRESH_KEY = "erp.refreshToken";
const BRANCH_KEY = "erp.branchId";

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

async function hydrateFromSupabase(accessToken: string): Promise<AuthSession> {
  const sb = getSupabase();

  const { data: userData, error: userErr } = await sb.auth.getUser(accessToken);
  if (userErr || !userData.user) {
    throw new Error(userErr?.message ?? "Invalid session");
  }

  const refresh = authStorage.getRefreshToken();
  if (refresh) {
    await sb.auth.setSession({ access_token: accessToken, refresh_token: refresh });
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

  const [{ data: branches, error: branchErr }, { data: perms, error: permErr }] =
    await Promise.all([
      sb.from("branch_memberships").select("branch_id").eq("user_id", profile.id),
      sb.rpc("get_user_permission_keys", { p_user_id: profile.id }),
    ]);

  if (branchErr) throw new Error(branchErr.message);
  if (permErr && !String(permErr.message).includes("get_user_permission_keys")) {
    throw new Error(permErr.message);
  }

  return {
    accessToken,
    user: profile,
    permissions: (perms as string[] | null) ?? [],
    branches: (branches ?? []).map((b) => String(b.branch_id)),
  };
}

function persistSession(session: AuthSession, refreshToken?: string | null) {
  authStorage.setToken(session.accessToken);
  if (refreshToken) authStorage.setRefreshToken(refreshToken);
  if (session.user.defaultBranchId) {
    authStorage.setBranchId(session.user.defaultBranchId);
  } else if (session.branches[0]) {
    authStorage.setBranchId(session.branches[0]);
  }
}

/** Auth orchestration lives outside React components. */
export const authService = {
  async login(input: LoginInput): Promise<AuthSession> {
    // Primary: browser → Supabase Auth (works when Vercel Express API is down)
    if (isSupabaseConfigured()) {
      const sb = getSupabase();
      const { data, error } = await sb.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      if (error || !data.session || !data.user) {
        throw new Error(error?.message ?? "Login failed");
      }

      authStorage.setRefreshToken(data.session.refresh_token);

      try {
        const session = await apiFetch<AuthSession>("/api/v1/auth/session", {
          token: data.session.access_token,
        });
        persistSession(session, data.session.refresh_token);
        return session;
      } catch (apiErr) {
        void apiErr;
        const session = await hydrateFromSupabase(data.session.access_token);
        persistSession(session, data.session.refresh_token);
        return session;
      }
    }

    const session = await apiFetch<AuthSession>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
    persistSession(session);
    return session;
  },

  async logout(): Promise<void> {
    const token = authStorage.getToken();
    if (token) {
      try {
        await apiFetch("/api/v1/auth/logout", { method: "POST", token });
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
    authStorage.setToken(null);
    authStorage.setRefreshToken(null);
  },

  async restore(): Promise<AuthSession | null> {
    const token = authStorage.getToken();
    if (!token) return null;

    try {
      return await apiFetch<AuthSession>("/api/v1/auth/session", { token });
    } catch {
      if (isSupabaseConfigured()) {
        try {
          const session = await hydrateFromSupabase(token);
          persistSession(session);
          return session;
        } catch {
          // fall through
        }
      }
      authStorage.setToken(null);
      authStorage.setRefreshToken(null);
      return null;
    }
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
    });
  },

  async me(token: string) {
    return apiFetch<{
      user: AuthSession["user"];
      permissions: string[];
      branches: string[];
      organizationId: string;
      branchId: string | null;
    }>("/api/v1/auth/me", { token });
  },
};
