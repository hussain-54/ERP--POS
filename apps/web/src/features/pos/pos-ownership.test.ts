import { describe, expect, it } from "vitest";
import { COMPAT_ALIAS_PATHS, ERP_MODULES, ERP_NAV_SECTIONS, EXTRA_APP_PATHS, POS_ENVIRONMENT_PATHS as MODULE_POS_ENVIRONMENT_PATHS, isPosEnvironmentPath } from "@/app/modules";
import {
  POS_CANONICAL_ENTRY,
  POS_ENVIRONMENT_PATHS,
  POS_IA_TITLES,
  POS_OWNERSHIP,
  POS_SHELL_NAV,
  POS_SHELL_NAV_TITLES,
  POS_SHELL_NAV_GROUP,
  posNavItemForPath,
  posShellNavItemForPath,
} from "./pos-ownership";

describe("POS ownership map", () => {
  it("locks the 12 POS names in authoritative order", () => {
    expect(POS_IA_TITLES).toEqual([
      "New Sale",
      "Hold / Resume",
      "Invoices",
      "Register",
      "Returns",
      "Exchange",
      "Payments",
      "Discounts",
      "References",
      "Salesmen",
      "Installments",
      "Settings",
    ]);
    expect(POS_OWNERSHIP.map((item) => item.title)).toEqual([...POS_IA_TITLES]);
    expect(POS_CANONICAL_ENTRY).toBe("/pos");
    expect(POS_OWNERSHIP[0]?.canonical).toBe("/pos");
  });

  it("keeps module 05 children aligned with the POS ownership map", () => {
    const sales = ERP_NAV_SECTIONS.find((s) => s.id === "05");
    expect(sales?.path).toBe("/pos");
    expect(sales?.children.map((c) => c.title)).toEqual([...POS_IA_TITLES]);
    expect(sales?.children.map((c) => c.path)).toEqual(POS_OWNERSHIP.map((item) => item.canonical));
  });

  it("registers canonical POS routes and preserves aliases", () => {
    const paths = new Set(ERP_MODULES.map((m) => m.path));
    expect(paths.has("/pos")).toBe(true);
    expect(COMPAT_ALIAS_PATHS.has("/pos/new")).toBe(true);
    expect(EXTRA_APP_PATHS).toContain("/pos/new");
    expect(paths.has("/held-sales")).toBe(true);
    expect(paths.has("/exchange")).toBe(true);
    expect(paths.has("/pos/salesmen")).toBe(true);
    expect(paths.has("/pos/references")).toBe(true);
    expect(paths.has("/pos/installments")).toBe(true);
    expect(paths.has("/credit")).toBe(true);
    expect(paths.has("/pos/settings")).toBe(true);
    expect(paths.has("/settings/pos")).toBe(true);
    expect(ERP_MODULES.find((m) => m.path === "/pos/settings")?.status).toBe("implemented");
    expect(ERP_MODULES.find((m) => m.path === "/settings/pos")?.status).toBe("placeholder");
    const discounts = ERP_MODULES.find((m) => m.path === "/discounts");
    expect(discounts?.status).toBe("implemented");
    expect(POS_OWNERSHIP.find((item) => item.title === "Discounts")?.status).toBe("live");
    expect(POS_OWNERSHIP.find((item) => item.title === "Salesmen")?.status).toBe("live");
    expect(POS_OWNERSHIP.find((item) => item.title === "References")?.status).toBe("live");
    expect(POS_OWNERSHIP.find((item) => item.title === "Installments")?.status).toBe("live");
    expect(POS_OWNERSHIP.find((item) => item.title === "Installments")?.aliases).toEqual([]);
    expect(POS_OWNERSHIP.filter((item) => item.status === "shared-live")).toEqual([]);
    expect(POS_OWNERSHIP.find((item) => item.title === "Settings")?.status).toBe("live");
  });

  it("maps POS operational routes into the environment without stealing ERP masters", () => {
    expect(POS_ENVIRONMENT_PATHS).toEqual([
      "/pos",
      "/pos/new",
      "/pos/customers",
      "/pos/products",
      "/pos/reports",
      "/held-sales",
      "/invoices",
      "/sales-management",
      "/returns",
      "/exchange",
      "/payments",
      "/discounts",
      "/pos/references",
      "/pos/salesmen",
      "/pos/installments",
      "/pos/settings",
    ]);
    expect(MODULE_POS_ENVIRONMENT_PATHS).toEqual(new Set(POS_ENVIRONMENT_PATHS));
    expect(isPosEnvironmentPath("/salesman")).toBe(false);
    expect(isPosEnvironmentPath("/installments")).toBe(false);
    expect(isPosEnvironmentPath("/credit")).toBe(false);
    expect(isPosEnvironmentPath("/settings/pos")).toBe(false);
    expect(posNavItemForPath("/pos/new")?.title).toBe("New Sale");
    expect(posNavItemForPath("/held-sales")?.title).toBe("Hold / Resume");
    expect(posNavItemForPath("/sales-management")?.title).toBe("Register");
    expect(posNavItemForPath("/exchange")?.title).toBe("Exchange");
    expect(posNavItemForPath("/pos/settings")?.title).toBe("Settings");
  });

  it("keeps a dedicated POS terminal sidebar separate from ERP Sales children", () => {
    expect(POS_SHELL_NAV.map((item) => item.title)).toEqual([...POS_SHELL_NAV_TITLES]);
    expect(POS_SHELL_NAV_GROUP).toBe("POS");
    expect(POS_SHELL_NAV.map((item) => item.path)).toEqual([
      "/pos",
      "/held-sales",
      "/pos/customers",
      "/pos/products",
      "/discounts",
      "/pos/reports",
      "/pos/settings",
    ]);
    expect(POS_SHELL_NAV.map((item) => item.icon)).toEqual([
      "pos",
      "hold",
      "customers",
      "products",
      "discount",
      "reports",
      "settings",
    ]);
    expect(isPosEnvironmentPath("/pos/customers")).toBe(true);
    expect(isPosEnvironmentPath("/pos/products")).toBe(true);
    expect(isPosEnvironmentPath("/pos/reports")).toBe(true);
    expect(posShellNavItemForPath("/invoices")?.title).toBe("Reports");
    expect(posShellNavItemForPath("/pos/new")?.title).toBe("New Sale");
  });
});
