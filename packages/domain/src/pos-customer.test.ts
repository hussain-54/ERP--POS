import { describe, expect, it } from "vitest";
import {
  assertPosCustomerForSale,
  evaluatePosCustomerCredit,
  maskCnicSimple,
  priceLevelForCustomerType,
  resolvePosCustomerMode,
  toCustomerSearchHit,
  toPosCustomerProfile,
} from "./pos-customer.js";
import type { Customer } from "@electronic-erp/contracts";

const baseCustomer: Customer = {
  id: "11111111-1111-4111-8111-111111111111",
  organizationId: "22222222-2222-4222-8222-222222222222",
  code: "C-1",
  name: "Ali Traders",
  mobile: "03001234567",
  email: "ali@example.com",
  address: "Lahore",
  cnic: "35202-1234567-1",
  customerType: "wholesale",
  creditLimit: "10000",
  creditDays: 30,
  totalPurchases: "5000",
  totalPaid: "2000",
  outstanding: "3000",
  isBlocked: false,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  version: 1,
  deletedAt: null,
};

describe("pos-customer", () => {
  it("maps walk-in / existing / new modes", () => {
    expect(resolvePosCustomerMode({ walkIn: true })).toBe("walk_in");
    expect(resolvePosCustomerMode({ walkIn: false, customerId: baseCustomer.id })).toBe("existing");
    expect(
      resolvePosCustomerMode({ walkIn: false, customerId: baseCustomer.id, isNewSelection: true }),
    ).toBe("new");
  });

  it("derives price tier from customer type", () => {
    expect(priceLevelForCustomerType("retail")).toBe("retail");
    expect(priceLevelForCustomerType("wholesale")).toBe("wholesale");
    expect(priceLevelForCustomerType("dealer")).toBe("dealer");
  });

  it("masks CNIC and omits sensitive fields from search hits", () => {
    const hit = toCustomerSearchHit(baseCustomer);
    expect(hit).toEqual({
      id: baseCustomer.id,
      code: "C-1",
      name: "Ali Traders",
      mobile: "03001234567",
      customerType: "wholesale",
    });
    expect("cnic" in hit).toBe(false);
    expect(maskCnicSimple(baseCustomer.cnic)).toBe("***********67-1");

    const profile = toPosCustomerProfile(baseCustomer, { loyaltyPoints: 120 });
    expect(profile.priceLevel).toBe("wholesale");
    expect(profile.loyaltyPoints).toBe(120);
    expect(profile.cnicMasked).not.toBe(baseCustomer.cnic);
  });

  it("evaluates credit for existing customer sales", () => {
    const profile = toPosCustomerProfile(baseCustomer);
    const ok = evaluatePosCustomerCredit({ customer: profile, additionalCredit: "1000" });
    expect(ok.allowed).toBe(true);
    const over = evaluatePosCustomerCredit({ customer: profile, additionalCredit: "20000" });
    expect(over.requiresApproval).toBe(true);
    expect(() =>
      assertPosCustomerForSale({
        mode: "existing",
        customer: { ...profile, isBlocked: true },
      }),
    ).toThrow(/blocked/i);
  });

  it("allows walk-in without customer record", () => {
    expect(() => assertPosCustomerForSale({ mode: "walk_in" })).not.toThrow();
  });
});
