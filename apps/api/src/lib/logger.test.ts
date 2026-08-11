import { describe, expect, it } from "vitest";
import { redactSensitive } from "./logger.js";

describe("logger redaction", () => {
  it("redacts password, token, and service role fields", () => {
    const out = redactSensitive({
      password: "secret123",
      access_token: "abc",
      service_role_key: "srk",
      user: "cashier",
      nested: { apiKey: "k", ok: true },
    }) as Record<string, unknown>;
    expect(out.password).toBe("[REDACTED]");
    expect(out.access_token).toBe("[REDACTED]");
    expect(out.service_role_key).toBe("[REDACTED]");
    expect(out.user).toBe("cashier");
    expect((out.nested as Record<string, unknown>).apiKey).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).ok).toBe(true);
  });
});
