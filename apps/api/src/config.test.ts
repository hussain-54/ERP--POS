import { describe, expect, it } from "vitest";
import { assertProductionConfig, config } from "./config.js";

describe("production config guard", () => {
  it("exposes a known appEnv", () => {
    expect(["development", "staging", "production"]).toContain(config.appEnv);
  });

  it("does not throw when running under development appEnv", () => {
    if (config.appEnv !== "development") return;
    expect(() => assertProductionConfig()).not.toThrow();
  });
});
