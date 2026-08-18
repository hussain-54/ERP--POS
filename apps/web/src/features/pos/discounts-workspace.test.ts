import { describe, expect, it } from "vitest";
import {
  applyDiscount,
  canActOnApproval,
  DISCOUNT_LIMITS,
  evaluateDiscountApproval,
} from "@electronic-erp/domain";
import {
  buildDiscountPolicyRows,
  canDecideDiscountApproval,
  DISCOUNT_TABLE_COLUMNS,
  evaluateDiscountAgainstPolicy,
  formatDiscountCap,
  parseDiscountApproval,
  parseDiscountValueInput,
  sessionActorRolesForDiscountWorkflow,
} from "./discounts-workspace";

describe("discount workspace policy", () => {
  it("keeps the locked table columns", () => {
    expect([...DISCOUNT_TABLE_COLUMNS]).toEqual([
      "Discount Type",
      "Value",
      "Maximum Allowed",
      "Approval Required",
      "Status",
    ]);
  });

  it("uses domain applyDiscount and evaluateDiscountApproval as the calculator", () => {
    const parsed = parseDiscountValueInput("12%");
    expect(parsed).toEqual({ mode: "percentage", value: 12 });
    const { applied, decision } = evaluateDiscountAgainstPolicy({
      base: 100,
      mode: parsed.mode,
      value: parsed.value,
      actingRole: "cashier",
    });
    expect(applied).toEqual(applyDiscount({ base: 100, mode: "percentage", value: 12, kind: "percentage" }));
    expect(decision).toEqual(
      evaluateDiscountApproval({
        discountAmount: applied.amount,
        baseAmount: 100,
        actingRole: "cashier",
      }),
    );
    expect(decision.needsApproval).toBe(true);
    expect(decision.allowed).toBe(false);
    expect(decision.maxAllowed).toBe(DISCOUNT_LIMITS.cashier);
  });

  it("does not invent a second grand total", () => {
    const { applied } = evaluateDiscountAgainstPolicy({
      base: 250,
      mode: "fixed",
      value: 40,
      actingRole: "manager",
    });
    expect(applied.amount).toBe(applyDiscount({ base: 250, mode: "fixed", value: 40 }).amount);
    expect(applied.amount).toBe(40);
  });

  it("shows the live role ladder and keeps price override permission-gated", () => {
    const cashier = buildDiscountPolicyRows({ actingRole: "cashier", canPriceOverride: false });
    expect(cashier.map((row) => row.discountType)).toContain("Line discount — percentage");
    expect(cashier.map((row) => row.discountType)).toContain("Invoice discount — fixed amount");
    expect(cashier.find((row) => row.id === "permission-cashier")?.maximumAllowed).toBe("5%");
    expect(cashier.find((row) => row.id === "permission-special")?.maximumAllowed).toBe("Unlimited");
    expect(cashier.find((row) => row.id === "max-policy")?.status).toBe("Never bypassed");
    const price = cashier.find((row) => row.id === "price-override");
    expect(price?.status).toBe("Blocked");
    expect(price?.approvalRequired).toMatch(/permission required/i);
    const manager = buildDiscountPolicyRows({ actingRole: "manager", canPriceOverride: true });
    expect(manager.find((row) => row.id === "price-override")?.status).toBe("Available");
    expect(formatDiscountCap(Number.POSITIVE_INFINITY)).toBe("Unlimited");
  });

  it("maps session discount permissions onto the real workflow roles without promoting cashiers", () => {
    expect(sessionActorRolesForDiscountWorkflow({ owner: false, cashier: true })).toEqual(["cashier"]);
    expect(sessionActorRolesForDiscountWorkflow({ owner: false, manager: true })).toEqual(["manager"]);
    expect(sessionActorRolesForDiscountWorkflow({ owner: true, manager: true, cashier: true })).toEqual([
      "owner",
      "manager",
      "cashier",
    ]);
    const pending = parseDiscountApproval({
      id: "a1",
      workflow_type: "discount",
      status: "pending",
      current_step: 1,
      title: "Invoice discount 12%",
      amount: 12,
      requester_role: "cashier",
    });
    expect(pending?.requiredRole).toBe("manager");
    expect(canDecideDiscountApproval(pending!, ["cashier"])).toBe(false);
    expect(canDecideDiscountApproval(pending!, ["manager"])).toBe(true);
    expect(
      canActOnApproval({
        workflow: "discount",
        currentStep: 1,
        status: "pending",
        actorRoles: ["cashier"],
      }),
    ).toBe(false);
    expect(parseDiscountApproval({ id: "x", workflow_type: "purchase" })).toBeNull();
  });
});
