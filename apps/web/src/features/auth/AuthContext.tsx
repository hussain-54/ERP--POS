import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthSession, LoginInput, UserProfile } from "@electronic-erp/contracts";
import { AuthorizationService } from "@electronic-erp/domain";
import {
  authService,
  authStorage,
  bindAuthLifecycle,
  INACTIVITY_TIMEOUT_MS,
  ensureFreshAccessToken,
  isInactivityTimedOut,
  noteUserActivity,
} from "./auth-service";
import {
  emitSessionExpired,
  SESSION_EXPIRED_EVENT,
  type SessionExpiredReason,
} from "./session-events";

interface AuthContextValue {
  loading: boolean;
  session: AuthSession | null;
  user: UserProfile | null;
  organizationId: string | null;
  branchId: string | null;
  permissions: string[];
  branches: string[];
  authz: AuthorizationService | null;
  sessionExpiredMessage: string | null;
  clearSessionExpiredMessage: () => void;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  setBranchId: (branchId: string) => void;
  hasPermission: (key: string) => boolean;
  /** Merge updated profile into the current session (after self-service edits). */
  refreshUser: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const WINDOW_ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "pointerdown",
  "keydown",
  "mousemove",
  "scroll",
  "touchstart",
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [branchId, setBranchIdState] = useState<string | null>(authStorage.getBranchId());
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
  const sessionRef = useRef<AuthSession | null>(null);
  const endingSessionRef = useRef(false);
  sessionRef.current = session;

  // Register before restore so inactivity/expired emits during bootstrap are not missed.
  useEffect(() => {
    function onExpired(event: Event) {
      const detail = (event as CustomEvent<{ reason?: SessionExpiredReason; message?: string }>).detail;
      setSession(null);
      setBranchIdState(null);
      setSessionExpiredMessage(
        detail?.message ?? "Your session has expired. Please sign in again.",
      );
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  useEffect(() => {
    let mounted = true;
    const unbind = bindAuthLifecycle();
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
        noteUserActivity();
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
      unbind();
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    let activityTimer: number | null = null;
    const onActivity = () => {
      if (document.visibilityState === "hidden") return;
      noteUserActivity();
    };

    for (const name of WINDOW_ACTIVITY_EVENTS) {
      window.addEventListener(name, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onActivity, { passive: true });

    const idleCheck = window.setInterval(() => {
      if (!sessionRef.current || endingSessionRef.current) return;
      if (isInactivityTimedOut()) {
        endingSessionRef.current = true;
        void (async () => {
          try {
            await authService.logout();
          } finally {
            emitSessionExpired("inactivity");
          }
        })();
      }
    }, 60_000);

    const softRefresh = () => {
      if (document.visibilityState === "hidden") return;
      void ensureFreshAccessToken().catch(() => undefined);
    };
    window.addEventListener("focus", softRefresh);
    document.addEventListener("visibilitychange", softRefresh);

    // Proactive refresh while the tab is open (POS-safe — no navigation).
    activityTimer = window.setInterval(() => {
      if (!sessionRef.current) return;
      void ensureFreshAccessToken().catch(() => undefined);
    }, 5 * 60_000);

    softRefresh();

    return () => {
      for (const name of WINDOW_ACTIVITY_EVENTS) {
        window.removeEventListener(name, onActivity);
      }
      document.removeEventListener("visibilitychange", onActivity);
      window.clearInterval(idleCheck);
      if (activityTimer != null) window.clearInterval(activityTimer);
      window.removeEventListener("focus", softRefresh);
      document.removeEventListener("visibilitychange", softRefresh);
    };
  }, [session]);

  const login = useCallback(async (input: LoginInput) => {
    const next = await authService.login(input);
    endingSessionRef.current = false;
    setSessionExpiredMessage(null);
    setSession(next);
    const preferred =
      authStorage.getBranchId() ?? next.user.defaultBranchId ?? next.branches[0] ?? null;
    setBranchIdState(preferred);
    noteUserActivity();
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setSession(null);
    setBranchIdState(null);
    setSessionExpiredMessage(null);
  }, []);

  const refreshUser = useCallback((nextUser: UserProfile) => {
    setSession((prev) => (prev ? { ...prev, user: nextUser } : prev));
  }, []);

  const setBranchId = useCallback((id: string) => {
    setBranchIdState(id);
    authStorage.setBranchId(id);
  }, []);

  const clearSessionExpiredMessage = useCallback(() => {
    setSessionExpiredMessage(null);
  }, []);

  const authz = useMemo(() => {
    if (!session?.user) return null;
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
      organizationId: session?.user?.organizationId ?? null,
      branchId,
      permissions: session?.permissions ?? [],
      branches: session?.branches ?? [],
      authz,
      sessionExpiredMessage,
      clearSessionExpiredMessage,
      login,
      logout,
      setBranchId,
      hasPermission: (key: string) => authz?.can(key) ?? false,
      refreshUser,
    }),
    [
      loading,
      session,
      branchId,
      authz,
      sessionExpiredMessage,
      clearSessionExpiredMessage,
      login,
      logout,
      setBranchId,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { INACTIVITY_TIMEOUT_MS };
