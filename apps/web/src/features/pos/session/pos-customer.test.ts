import { describe, expect, it } from "vitest";
import {
  assertPosCustomerForSale,
  evaluatePosCustomerCredit,
  priceLevelForCustomerType,
  resolvePosCustomerMode,
  toPosCustomerProfile,
} from "@electronic-erp/domain";
import { PosCustomerOfflineCache } from "./pos-customer-runtime";

const org = "11111111-1111-4111-8111-111111111111";

describe("POS customer session flows", () => {
  it("supports walk-in, existing, new, switching, pricing, and credit", () => {
    expect(resolvePosCustomerMode({ walkIn: true })).toBe("walk_in");
    expect(() => assertPosCustomerForSale({ mode: "walk_in" })).not.toThrow();

    const cache = new PosCustomerOfflineCache();
    const created = cache.create({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      organizationId: org,
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

    const other = cache.create({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      organizationId: org,
      code: "E1",
      name: "Existing Retail",
      customerType: "retail",
      creditLimit: "1000",
      creditDays: 7,
    });
    // switch customer for current sale
    const switched = toPosCustomerProfile(cache.get(other.id)!);
    expect(switched.priceLevel).toBe("retail");
    expect(resolvePosCustomerMode({ walkIn: false, customerId: switched.id })).toBe("existing");

    const credit = evaluatePosCustomerCredit({
      customer: { ...profile, outstanding: "14000" },
      additionalCredit: "2000",
    });
    expect(credit.requiresApproval).toBe(true);
  });
});
