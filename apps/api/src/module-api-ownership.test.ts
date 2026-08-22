import { describe, expect, it } from "vitest";
import {
  API_GROUP_TO_MODULES,
  MODULE_API_OWNERSHIP,
  NON_MODULE_API_GROUPS,
  OWNERSHIP_AMBIGUITIES,
  SHARED_WEB_API_CLIENTS,
} from "./module-api-ownership.js";

describe("module API ownership", () => {
  it("lists exactly 39 product modules with unique ids", () => {
    expect(MODULE_API_OWNERSHIP).toHaveLength(39);
    expect(MODULE_API_OWNERSHIP.map((row) => row.id)).toEqual(
      Array.from({ length: 39 }, (_, i) => String(i + 1).padStart(2, "0")),
    );
    expect(MODULE_API_OWNERSHIP.map((row) => row.module)).toEqual([
      "COMMAND CENTER",
      "POS / SALES",
      "PRODUCT & CATALOG",
      "PURCHASING",
      "INVENTORY",
      "WAREHOUSE / WMS",
      "DELIVERY / LOGISTICS",
      "CUSTOMERS / CRM",
      "SERVICE MANAGEMENT",
      "WARRANTY",
      "ACCOUNTS & FINANCE",
      "BANKING & PAYMENTS",
      "REPORTS & BUSINESS INTELLIGENCE",
      "AI & AUTOMATION",
      "MARKETING & LOYALTY",
      "B2B / WHOLESALE",
      "ONLINE STORE",
      "MOBILE",
      "ORGANIZATION / BRANCHES",
      "HR & PAYROLL",
      "TAX / FBR",
      "DOCUMENT MANAGEMENT",
      "WORKFLOW / APPROVALS",
      "NOTIFICATIONS",
      "USERS / ROLES / PERMISSIONS",
      "SECURITY / AUDIT",
      "OFFLINE / LOCAL OPERATIONS",
      "SYNC CENTER",
      "BACKUP / DISASTER RECOVERY",
      "INTEGRATION HUB",
      "DEVICES / PRINTING",
      "INDUSTRY ENGINE",
      "CUSTOMIZATION ENGINE",
      "RULES / AUTOMATION ENGINE",
      "CLIENT / TENANT MANAGEMENT",
      "SUBSCRIPTION / BILLING",
      "USAGE / METERING",
      "DEVELOPER PLATFORM",
      "SYSTEM ADMINISTRATION",
    ]);
  });

  it("keeps grouped routers instead of one router per module", () => {
    const groups = new Set(
      MODULE_API_OWNERSHIP.flatMap((row) =>
        row.apiGroup
          .split(",")
          .map((s) => s.trim())
          .filter((g) => g !== "none"),
      ),
    );
    expect(groups.size).toBeLessThan(39);
    for (const name of [
      "catalog",
      "inventory",
      "parties",
      "purchases",
      "after-sales",
      "accounting",
      "admin",
      "hardware",
      "reports",
      "commerce",
      "ai",
      "enterprise",
      "infrastructure",
    ]) {
      expect(groups.has(name)).toBe(true);
    }
  });

  it("keeps delivery on the purchases group", () => {
    const delivery = MODULE_API_OWNERSHIP.find((row) => row.id === "07");
    expect(delivery?.module).toBe("DELIVERY / LOGISTICS");
    expect(delivery?.apiGroup).toBe("purchases");
    expect(delivery?.mount).toContain("/api/v1/purchases/deliveries");
    expect(API_GROUP_TO_MODULES.purchases).toContain("07");
  });

  it("documents shared web clients and known ambiguities", () => {
    expect(SHARED_WEB_API_CLIENTS.map((row) => row.client)).toEqual([
      "parties-api",
      "after-sales-api",
      "admin-api",
      "commerce-api",
      "enterprise-api",
      "infrastructure-api",
    ]);
    expect(OWNERSHIP_AMBIGUITIES.some((row) => row.topic === "Delivery")).toBe(true);
    expect(NON_MODULE_API_GROUPS.map((row) => row.apiGroup)).toEqual(["auth", "health"]);
  });
});
