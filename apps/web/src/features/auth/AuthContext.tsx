import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthSession, LoginInput, UserProfile } from "@electronic-erp/contracts";
import { AuthorizationService } from "@electronic-erp/domain";
import { authService, authStorage } from "./auth-service";

interface AuthContextValue {
  loading: boolean;
  session: AuthSession | null;
  user: UserProfile | null;
  organizationId: string | null;
  branchId: string | null;
  permissions: string[];
  branches: string[];
  authz: AuthorizationService | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  setBranchId: (branchId: string) => void;
  hasPermission: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [branchId, setBranchIdState] = useState<string | null>(authStorage.getBranchId());

  useEffect(() => {
    let mounted = true;
    (async () => {
      const restored = await authService.restore();
      if (!mounted) return;
      setSession(restored);
      if (restored) {
        const preferred =
          authStorage.getBranchId() ??
          restored.user.defaultBranchId ??
          restored.branches[0] ??
          null;
        setBranchIdState(preferred);
        authStorage.setBranchId(preferred);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const next = await authService.login(input);
    setSession(next);
    const preferred =
      authStorage.getBranchId() ?? next.user.defaultBranchId ?? next.branches[0] ?? null;
    setBranchIdState(preferred);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setSession(null);
    setBranchIdState(null);
  }, []);

  const setBranchId = useCallback((id: string) => {
    setBranchIdState(id);
    authStorage.setBranchId(id);
  }, []);

  const authz = useMemo(() => {
    if (!session) return null;
    return new AuthorizationService({
      userId: session.user.id,
      organizationId: session.user.organizationId,
      branchId,
      permissions: session.permissions,
      branchIds: session.branches,
    });
  }, [session, branchId]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      organizationId: session?.user.organizationId ?? null,
      branchId,
      permissions: session?.permissions ?? [],
      branches: session?.branches ?? [],
      authz,
      login,
      logout,
      setBranchId,
      hasPermission: (key: string) => authz?.can(key) ?? false,
    }),
    [loading, session, branchId, authz, login, logout, setBranchId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
