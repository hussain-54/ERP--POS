import { describe, expect, it } from "vitest";
import { ForbiddenDomainError, ValidationDomainError } from "./errors.js";
import { defaultPermissionsForRole } from "./rbac-catalog.js";
import {
  POS_UNAVAILABLE_SENSITIVE_ACTIONS,
  assertPosCreditRemainderAllowed,
  assertPosInstallmentSaleAllowed,
  canActOnOwnedOrForeignHold,
  canPosDiscount,
  canPosPriceOverride,
  estimatePostedSaleRemaining,
  evaluateCustomerCreditForRemainder,
  posDiscountRoleFromPermissions,
} from "./pos-security.js";

const unit = "11111111-1111-4111-8111-111111111111";
const product = "22222222-2222-4222-8222-222222222222";
const org = "33333333-3333-4333-8333-333333333333";
const branch = "44444444-4444-4444-8444-444444444444";
const warehouse = "55555555-5555-4555-8555-555555555555";
const customer = "66666666-6666-4666-8666-666666666666";
const method = "77777777-7777-4777-8777-777777777777";
const key = "88888888-8888-4888-8888-888888888888";

describe("POS RBAC sensitive actions", () => {
  it("maps cashier vs manager using existing permission keys", () => {
    const cashier = defaultPermissionsForRole("cashier");
    const manager = defaultPermissionsForRole("manager");
    expect(cashier).toContain("pos.sell");
    expect(canPosDiscount(cashier)).toBe(true);
    expect(canPosPriceOverride(cashier)).toBe(false);
    expect(posDiscountRoleFromPermissions(cashier)).toBe("cashier");
    expect(cashier).not.toContain("credit.approve");
    expect(cashier).not.toContain("installments.manage");
    expect(cashier).not.toContain("pos.resume_any");

    expect(canPosPriceOverride(manager)).toBe(true);
    expect(posDiscountRoleFromPermissions(manager)).toBe("manager");
    expect(manager).toContain("credit.approve");
    expect(manager).toContain("pos.resume_any");
    expect(manager).not.toContain("installments.manage");
  });

  it("does not invent keys for unavailable POS mutations", () => {
    expect(POS_UNAVAILABLE_SENSITIVE_ACTIONS).toEqual([
      "void_posted_sale",
      "cash_in",
      "cash_out",
      "payment_reversal",
    ]);
  });

  it("blocks installment create without installments.manage", () => {
    expect(() => assertPosInstallmentSaleAllowed(false, true)).toThrow(ForbiddenDomainError);
    expect(() => assertPosInstallmentSaleAllowed(true, true)).not.toThrow();
    expect(() => assertPosInstallmentSaleAllowed(false, false)).not.toThrow();
  });

  it("allows in-limit credit remainder and requires credit.approve when over limit", () => {
    const within = evaluateCustomerCreditForRemainder({
      creditLimit: "50000",
      outstanding: "1000",
      creditDays: 30,
      isBlocked: false,
      remaining: 500,
    });
    expect(() =>
      assertPosCreditRemainderAllowed({
        remaining: 500,
        customerId: customer,
        credit: within,
        canApproveOverLimit: false,
      }),
    ).not.toThrow();

    const over = evaluateCustomerCreditForRemainder({
      creditLimit: "1000",
      outstanding: "900",
      creditDays: 30,
      isBlocked: false,
      remaining: 500,
    });
    expect(() =>
      assertPosCreditRemainderAllowed({
        remaining: 500,
        customerId: customer,
        credit: over,
        canApproveOverLimit: false,
      }),
    ).toThrow(/credit\.approve/);
    expect(() =>
      assertPosCreditRemainderAllowed({
        remaining: 500,
        customerId: customer,
        credit: over,
        canApproveOverLimit: true,
      }),
    ).not.toThrow();
  });

  it("blocks blocked customers on credit remainder", () => {
    const blocked = evaluateCustomerCreditForRemainder({
      creditLimit: "50000",
      outstanding: "0",
      creditDays: 30,
      isBlocked: true,
      remaining: 10,
    });
    expect(() =>
      assertPosCreditRemainderAllowed({
        remaining: 10,
        customerId: customer,
        credit: blocked,
        canApproveOverLimit: true,
      }),
    ).toThrow(ValidationDomainError);
  });

  it("lets a cashier act on their hold but not another cashier without pos.resume_any", () => {
    const cashier = defaultPermissionsForRole("cashier");
    const manager = defaultPermissionsForRole("manager");
    expect(
      canActOnOwnedOrForeignHold({
        heldBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        granted: cashier,
      }),
    ).toBe(true);
    expect(
      canActOnOwnedOrForeignHold({
        heldBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        actorUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        granted: cashier,
      }),
    ).toBe(false);
    expect(
      canActOnOwnedOrForeignHold({
        heldBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        actorUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        granted: manager,
      }),
    ).toBe(true);
  });

  it("estimates remaining due from posted sale payments", () => {
    const remaining = estimatePostedSaleRemaining({
      organizationId: org,
      branchId: branch,
      warehouseId: warehouse,
      customerId: customer,
      items: [
        {
          productId: product,
          unitId: unit,
          qty: 1,
          unitPrice: 100,
          discount: 0,
          tax: 0,
        },
      ],
      payments: [{ paymentMethodId: method, amount: 40 }],
      discountTotal: 0,
      idempotencyKey: key,
    });
    expect(remaining).toBeCloseTo(60, 2);
  });
});
