import { env } from "./env";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  const res = await fetch(`${env.apiUrl}${path}`, {
    ...options,
    headers,
  });

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
      // Non-JSON (often HTML SPA fallback when API is missing)
      if (res.status >= 500) message = "Internal server error";
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
