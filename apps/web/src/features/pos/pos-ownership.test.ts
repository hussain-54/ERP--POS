import { describe, expect, it } from "vitest";
import {
  COMPAT_ALIAS_PATHS,
  ERP_MODULES,
  ERP_NAV_SECTIONS,
  EXTRA_APP_PATHS,
  POS_ENVIRONMENT_PATHS as MODULE_POS_ENVIRONMENT_PATHS,
  isPosEnvironmentPath,
} from "@/app/modules";
import {
  POS_CANONICAL_ENTRY,
  POS_ENVIRONMENT_PATHS,
  POS_IA_TITLES,
  POS_OWNERSHIP,
  POS_TERMINAL_NAV,
  posNavItemForPath,
} from "./pos-ownership";

describe("POS ownership map", () => {
  it("locks the 26 POS names in authoritative order", () => {
    expect(POS_IA_TITLES).toHaveLength(26);
    expect(POS_IA_TITLES[0]).toBe("POS Terminal");
    expect(POS_IA_TITLES[9]).toBe("Hold Sale");
    expect(POS_IA_TITLES[10]).toBe("Resume Sale");
    expect(POS_IA_TITLES[25]).toBe("Offline POS");
    expect(POS_OWNERSHIP.map((item) => item.title)).toEqual([...POS_IA_TITLES]);
    expect(POS_CANONICAL_ENTRY).toBe("/pos");
    expect(POS_OWNERSHIP[0]?.canonical).toBe("/pos");
  });

  it("keeps module 02 children aligned with the POS ownership map", () => {
    const sales = ERP_NAV_SECTIONS.find((s) => s.id === "02");
    expect(sales?.path).toBe("/pos");
    expect(sales?.children.map((c) => c.title)).toEqual([...POS_IA_TITLES]);
    expect(sales?.children.map((c) => c.path)).toEqual(POS_OWNERSHIP.map((item) => item.canonical));
    expect(POS_TERMINAL_NAV.map((item) => item.path)).toEqual([
      "/pos",
      "/pos/resume-sale",
      "/pos/customer-selection",
      "/pos/product-search",
      "/discounts",
      "/pos/reports",
      "/pos/settings",
    ]);
  });

  it("registers canonical POS routes and preserves critical aliases", () => {
    const paths = new Set(ERP_MODULES.map((m) => m.path));
    expect(paths.has("/pos")).toBe(true);
    expect(COMPAT_ALIAS_PATHS.has("/pos/new") || EXTRA_APP_PATHS.includes("/pos/new")).toBe(true);
    expect(paths.has("/pos/resume-sale")).toBe(true);
    expect(paths.has("/pos/hold-sale")).toBe(true);
    expect(paths.has("/exchange")).toBe(true);
    expect(paths.has("/pos/salesman-reference")).toBe(true);
    expect(paths.has("/pos/installments")).toBe(true);
    expect(paths.has("/pos/coupons")).toBe(true);
    expect(paths.has("/pos/offline")).toBe(true);
    expect(POS_OWNERSHIP.find((item) => item.title === "Coupons")?.status).toBe("live");
    expect(POS_OWNERSHIP.find((item) => item.title === "Offline POS")?.status).toBe("placeholder");
    expect(POS_OWNERSHIP.find((item) => item.title === "POS Terminal")?.status).toBe("live");
    expect(POS_TERMINAL_NAV.map((item) => item.label)).toEqual([
      "POS",
      "Hold / Resume",
      "Customers",
      "Products",
      "Price & Discount",
      "Reports",
      "Settings",
    ]);
    expect(posNavItemForPath("/held-sales")?.title).toBe("Resume Sale");
    expect(posNavItemForPath("/pos/new")?.title).toBe("POS Terminal");
  });

  it("maps POS operational routes into the environment without stealing ERP masters", () => {
    expect(POS_ENVIRONMENT_PATHS).toContain("/pos");
    expect(POS_ENVIRONMENT_PATHS).toContain("/pos/offline");
    expect(POS_ENVIRONMENT_PATHS).toContain("/pos/shift");
    expect([...MODULE_POS_ENVIRONMENT_PATHS]).toEqual([...POS_ENVIRONMENT_PATHS]);
    expect(isPosEnvironmentPath("/pos")).toBe(true);
    expect(isPosEnvironmentPath("/salesman")).toBe(false);
    expect(isPosEnvironmentPath("/installments")).toBe(false);
    expect(isPosEnvironmentPath("/settings/pos")).toBe(false);
  });
});
