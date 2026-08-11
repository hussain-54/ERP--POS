import { describe, expect, it } from "vitest";
import {
  DEFAULT_PASSWORD_POLICY,
  encryptionStrategySummary,
  generateApiKeyMaterial,
  hashApiKey,
  isAccountLocked,
  nextLockoutUntil,
  planBackupJob,
  rowsToCsv,
  rowsToExcelTsv,
  validatePasswordAgainstPolicy,
} from "./infrastructure.js";

describe("security policy", () => {
  it("enforces password policy and lockout", () => {
    expect(validatePasswordAgainstPolicy("short", DEFAULT_PASSWORD_POLICY).ok).toBe(false);
    expect(validatePasswordAgainstPolicy("GoodPass12", DEFAULT_PASSWORD_POLICY).ok).toBe(true);
    expect(
      isAccountLocked({
        failedAttempts: 5,
        maxFailedAttempts: 5,
      }).locked,
    ).toBe(true);
    const until = nextLockoutUntil(15, new Date("2026-08-11T10:00:00Z"));
    expect(until).toContain("2026-08-11T10:15");
  });

  it("documents encryption strategy without exposing secrets to frontend", () => {
    const s = encryptionStrategySummary();
    expect(s.secrets).toMatch(/server-side/i);
    expect(s.inTransit).toMatch(/TLS/i);
  });
});

describe("backup + api keys + export", () => {
  it("plans backup without claiming DR", () => {
    const plan = planBackupJob({ mode: "incremental", target: "cloud", encrypted: true });
    expect(plan.disasterRecoveryClaim).toBe(false);
    expect(plan.verificationRequired).toBe(true);
    expect(plan.incrementalBaseRequired).toBe(true);
  });

  it("hashes api keys and exports csv/excel", () => {
    const { rawKey, prefix } = generateApiKeyMaterial("mobile");
    expect(prefix.startsWith("erp_mobile")).toBe(true);
    expect(hashApiKey(rawKey)).toContain(rawKey.slice(-4));
    expect(rowsToCsv(["a", "b"], [[1, 2]])).toBe("a,b\n1,2");
    expect(rowsToExcelTsv(["a", "b"], [["x", "y"]])).toContain("\t");
  });
});
