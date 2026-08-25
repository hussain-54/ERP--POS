import { env } from "./env";
import { INTERNET_REQUIRED_MESSAGE, isNetworkFailure } from "./online-required";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiFetchOptions = RequestInit & {
  token?: string;
  /** Skip proactive / 401 refresh (auth bootstrap paths). */
  skipAuthRefresh?: boolean;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { token: initialToken, skipAuthRefresh, ...init } = options;

  let token = initialToken;
  if (!skipAuthRefresh && !token) {
    try {
      const { ensureFreshAccessToken, authStorage } = await import("@/features/auth/auth-service");
      token = (await ensureFreshAccessToken()) ?? authStorage.getToken() ?? undefined;
    } catch {
      // Auth module may be unavailable during early bootstrap.
    }
  } else if (!skipAuthRefresh && token) {
    try {
      const { ensureFreshAccessToken } = await import("@/features/auth/auth-service");
      const fresh = await ensureFreshAccessToken();
      if (fresh) token = fresh;
    } catch {
      // keep provided token
    }
  }

  const doFetch = async (bearer?: string) => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (bearer) headers.set("Authorization", `Bearer ${bearer}`);

    try {
      return await fetch(`${env.apiUrl}${path}`, {
        ...init,
        headers,
      });
    } catch (err) {
      if (isNetworkFailure(err) || (typeof navigator !== "undefined" && !navigator.onLine)) {
        throw new ApiError(INTERNET_REQUIRED_MESSAGE, 0);
      }
      throw err instanceof Error ? err : new Error(String(err));
    }
  };

  let res = await doFetch(token);

  if (res.status === 401 && !skipAuthRefresh) {
    try {
      const { authService } = await import("@/features/auth/auth-service");
      const next = await authService.handleUnauthorized();
      if (next) {
        res = await doFetch(next);
        if (res.status === 401) {
          authService.forceSessionExpired("invalid");
        }
      }
    } catch {
      // fall through with original 401
    }
  }

  if (!res.ok) {
    let message = res.statusText || `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as {
        error?: string | { message?: string };
        detail?: string;
      };
      if (typeof body.error === "string") message = body.error;
      else if (body.error && typeof body.error === "object" && body.error.message) {
        message = body.error.message;
      } else if (body.detail) message = body.detail;
    } catch {
      if (res.status >= 500) message = "Internal server error";
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
