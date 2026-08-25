import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

/**
 * Lightweight unit coverage for JWT expiry helpers used by session refresh.
 * Mirrors auth-service access-token skew logic without mounting Supabase.
 */

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

function accessTokenNeedsRefresh(token: string | null, skewMs = 90_000): boolean {
  if (!token) return true;
  const exp = jwtExpiresAtMs(token);
  if (exp == null) return false;
  return exp - Date.now() <= skewMs;
}

function makeJwt(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ exp: expSeconds }));
  return `${header}.${payload}.sig`;
}

describe("access token refresh skew", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats missing token as needing refresh", () => {
    expect(accessTokenNeedsRefresh(null)).toBe(true);
  });

  it("does not refresh a token with plenty of life left", () => {
    const token = makeJwt(Math.floor(Date.now() / 1000) + 3600);
    expect(accessTokenNeedsRefresh(token)).toBe(false);
  });

  it("refreshes when within skew window", () => {
    const token = makeJwt(Math.floor(Date.now() / 1000) + 60);
    expect(accessTokenNeedsRefresh(token, 90_000)).toBe(true);
  });

  it("treats already-expired tokens as needing refresh", () => {
    const token = makeJwt(Math.floor(Date.now() / 1000) - 10);
    expect(accessTokenNeedsRefresh(token, 90_000)).toBe(true);
  });
});
