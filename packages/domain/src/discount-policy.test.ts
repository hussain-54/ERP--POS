import { describe, expect, it } from "vitest";
import {
  assertDiscountAllowed,
  DISCOUNT_LIMITS,
  effectiveDiscountPercent,
  evaluateDiscountApproval,
  maxDiscountPercentForRole,
  requiredApproverRoleForPercent,
  roleCanApprovePercent,
} from "./discount-policy.js";

describe("discount-policy ladder", () => {
  it("maps percent bands to required roles", () => {
    expect(requiredApproverRoleForPercent(0)).toBe("cashier");
    expect(requiredApproverRoleForPercent(4.99)).toBe("cashier");
    expect(requiredApproverRoleForPercent(5)).toBe("cashier");
    expect(requiredApproverRoleForPercent(5.01)).toBe("supervisor");
    expect(requiredApproverRoleForPercent(10)).toBe("supervisor");
    expect(requiredApproverRoleForPercent(10.01)).toBe("manager");
    expect(requiredApproverRoleForPercent(20)).toBe("manager");
    expect(requiredApproverRoleForPercent(20.01)).toBe("owner");
    expect(requiredApproverRoleForPercent(50)).toBe("owner");
    expect(requiredApproverRoleForPercent(50.01)).toBe("special");
  });

  it("exposes inclusive role limits", () => {
    expect(DISCOUNT_LIMITS.cashier).toBe(5);
    expect(DISCOUNT_LIMITS.supervisor).toBe(10);
    expect(DISCOUNT_LIMITS.manager).toBe(20);
    expect(DISCOUNT_LIMITS.owner).toBe(50);
    expect(maxDiscountPercentForRole("special")).toBe(Number.POSITIVE_INFINITY);
  });

  it("roleCanApprovePercent respects hierarchy", () => {
    expect(roleCanApprovePercent("cashier", 5)).toBe(true);
    expect(roleCanApprovePercent("cashier", 6)).toBe(false);
    expect(roleCanApprovePercent("manager", 15)).toBe(true);
    expect(roleCanApprovePercent("owner", 40)).toBe(true);
    expect(roleCanApprovePercent("owner", 60)).toBe(false);
    expect(roleCanApprovePercent("special", 99)).toBe(true);
  });

  it("assertDiscountAllowed throws with required role", () => {
    expect(() => assertDiscountAllowed("manager", 25)).toThrow(/owner/i);
  });

  it("evaluateDiscountApproval computes needsApproval", () => {
    const d = evaluateDiscountApproval({
      discountAmount: 12,
      baseAmount: 100,
      actingRole: "cashier",
    });
    expect(d.percent).toBe(12);
    expect(d.requiredRole).toBe("manager");
    expect(d.allowed).toBe(false);
    expect(d.needsApproval).toBe(true);
  });

  it("effectiveDiscountPercent guards NaN/zero base", () => {
    expect(effectiveDiscountPercent(10, 0)).toBe(0);
    expect(effectiveDiscountPercent(Number.NaN, 100)).toBe(0);
  });
});
