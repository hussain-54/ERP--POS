import { describe, expect, it } from "vitest";
import type { Customer } from "@electronic-erp/contracts";
import {
  assertPosCustomerForSale,
  evaluatePosCustomerCredit,
  priceLevelForCustomerType,
  resolvePosCustomerMode,
  toPosCustomerProfile,
} from "@electronic-erp/domain";

const org = "11111111-1111-4111-8111-111111111111";

function customer(partial: Partial<Customer> & Pick<Customer, "id" | "code" | "name">): Customer {
  const now = new Date().toISOString();
  return {
    organizationId: org,
    nameUr: null,
    mobile: null,
    alternateMobile: null,
    email: null,
    address: null,
    cnic: null,
    referenceName: null,
    customerType: "retail",
    creditLimit: "0",
    creditDays: 0,
    totalPurchases: "0",
    totalPaid: "0",
    outstanding: "0",
    isBlocked: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    version: 1,
    deletedAt: null,
    ...partial,
  };
}

describe("POS customer session flows", () => {
  it("supports walk-in, existing, new, switching, pricing, and credit", () => {
    expect(resolvePosCustomerMode({ walkIn: true })).toBe("walk_in");
    expect(() => assertPosCustomerForSale({ mode: "walk_in" })).not.toThrow();

    const created = customer({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      code: "N1",
      name: "New Customer",
      mobile: "03003333333",
      email: "new@example.com",
      address: "Karachi",
      cnic: "42101-1234567-8",
      customerType: "wholesale",
      creditLimit: "15000",
    });
    const profile = toPosCustomerProfile(created, { loyaltyPoints: 10 });
    expect(resolvePosCustomerMode({ walkIn: false, customerId: profile.id, isNewSelection: true })).toBe(
      "new",
    );
    expect(profile.priceLevel).toBe(priceLevelForCustomerType("wholesale"));

    const other = customer({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      code: "E1",
      name: "Existing Retail",
      customerType: "retail",
      creditLimit: "1000",
      creditDays: 7,
    });
    const switched = toPosCustomerProfile(other);
    expect(switched.priceLevel).toBe("retail");
    expect(resolvePosCustomerMode({ walkIn: false, customerId: switched.id })).toBe("existing");

    const credit = evaluatePosCustomerCredit({
      customer: { ...profile, outstanding: "14000" },
      additionalCredit: "2000",
    });
    expect(credit.requiresApproval).toBe(true);
  });
});
