import type { AuthSession, LoginInput } from "@electronic-erp/contracts";
import { apiFetch } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";

const TOKEN_KEY = "erp.accessToken";
const BRANCH_KEY = "erp.branchId";

export const authStorage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string | null) {
    if (!token) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  },
  getBranchId(): string | null {
    return localStorage.getItem(BRANCH_KEY);
  },
  setBranchId(branchId: string | null) {
    if (!branchId) localStorage.removeItem(BRANCH_KEY);
    else localStorage.setItem(BRANCH_KEY, branchId);
  },
};

/** Auth orchestration lives outside React components. */
export const authService = {
  async login(input: LoginInput): Promise<AuthSession> {
    const session = await apiFetch<AuthSession>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
    authStorage.setToken(session.accessToken);
    if (session.user.defaultBranchId) {
      authStorage.setBranchId(session.user.defaultBranchId);
    } else if (session.branches[0]) {
      authStorage.setBranchId(session.branches[0]);
    }
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
  },

  async restore(): Promise<AuthSession | null> {
    const token = authStorage.getToken();
    if (!token) return null;
    try {
      return await apiFetch<AuthSession>("/api/v1/auth/session", { token });
    } catch {
      authStorage.setToken(null);
      return null;
    }
  },

  async requestPasswordReset(email: string): Promise<void> {
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
