import { describe, expect, it } from "vitest";
import { defaultPermissionsForRole } from "@electronic-erp/domain";
import {
  POS_UNAVAILABLE_SENSITIVE_ACTIONS,
  posActionFlags,
} from "./pos-security";

describe("POS UI permission flags", () => {
  it("hides manager-only mutations from the cashier catalog", () => {
    const cashier = new Set(defaultPermissionsForRole("cashier"));
    const flags = posActionFlags((key) => cashier.has(key));
    expect(flags.canSell).toBe(true);
    expect(flags.canHold).toBe(true);
    expect(flags.canReturn).toBe(true);
    expect(flags.canShift).toBe(true);
    expect(flags.canDiscount).toBe(true);
    expect(flags.canPriceOverride).toBe(false);
    expect(flags.canResumeAny).toBe(false);
    expect(flags.canCreditApprove).toBe(false);
    expect(flags.canInstallment).toBe(false);
  });

  it("allows manager price override, foreign holds, and over-limit credit", () => {
    const manager = new Set(defaultPermissionsForRole("manager"));
    const flags = posActionFlags((key) => manager.has(key));
    expect(flags.canPriceOverride).toBe(true);
    expect(flags.canResumeAny).toBe(true);
    expect(flags.canCreditApprove).toBe(true);
    expect(flags.canInstallment).toBe(false);
  });

  it("does not invent UI for unavailable POS mutations", () => {
    expect(POS_UNAVAILABLE_SENSITIVE_ACTIONS).toContain("void_posted_sale");
    expect(POS_UNAVAILABLE_SENSITIVE_ACTIONS).toContain("cash_in");
    expect(POS_UNAVAILABLE_SENSITIVE_ACTIONS).toContain("payment_reversal");
  });
});
