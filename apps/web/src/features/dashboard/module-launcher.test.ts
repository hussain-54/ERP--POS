import { describe, expect, it } from "vitest";
import { ERP_MODULES, ERP_NAV_SECTIONS, ERP_STABLE_PARENT_PATHS } from "@/app/modules";
import {
  assertLauncherCoversParents,
  filterLauncherModules,
  launcherModules,
  launcherParentPaths,
  launcherSuggestions,
} from "./module-launcher";

describe("ERP module launcher", () => {
  it("builds 39 cards from the module registry and ERP_MODULES", () => {
    const cards = launcherModules();
    expect(cards).toHaveLength(39);
    expect(cards.map((card) => card.path)).toEqual([...ERP_STABLE_PARENT_PATHS]);
    expect(launcherParentPaths()).toEqual(ERP_NAV_SECTIONS.map((section) => section.path));
    expect(assertLauncherCoversParents()).toBe(true);

    for (const card of cards) {
      const route = ERP_MODULES.find((module) => module.path === card.path);
      const section = ERP_NAV_SECTIONS.find((row) => row.id === card.id);
      expect(route, card.path).toBeTruthy();
      expect(section, card.id).toBeTruthy();
      expect(card.name).toBe(route?.title);
      expect(card.description).toBe(route?.description);
      expect(card.number).toBe(section?.number);
      expect(card.icon).toBe(section?.icon);
      expect(card.permission).toBe(route?.permission ?? section?.permission);
    }
  });

  it("suggests POS invoices without treating child features as extra modules", () => {
    const hits = filterLauncherModules("invoice");
    expect(hits.map((hit) => hit.module.name)).toContain("POS / SALES");
    const pos = hits.find((hit) => hit.module.id === "02");
    expect(pos?.matchedChildren.some((child) => child.title === "Invoices")).toBe(true);

    const suggestions = launcherSuggestions("invoice");
    const invoice = suggestions.find((item) => item.childTitle === "Invoices");
    expect(invoice).toMatchObject({
      moduleNumber: "02",
      moduleName: "POS / SALES",
      href: "/pos/invoices",
    });
    expect(suggestions.every((item) => ERP_STABLE_PARENT_PATHS.includes(item.modulePath as (typeof ERP_STABLE_PARENT_PATHS)[number]))).toBe(
      true,
    );
  });

  it("suggests the warehouse parent from the module name", () => {
    const suggestions = launcherSuggestions("warehouse");
    expect(suggestions.some((item) => item.moduleNumber === "06" && item.moduleName === "WAREHOUSE / WMS" && !item.childTitle)).toBe(
      true,
    );
    expect(suggestions.find((item) => item.moduleNumber === "06")?.href).toBe("/warehouse");
  });

  it("finds a module by its number", () => {
    const suggestions = launcherSuggestions("02");
    expect(suggestions).toEqual([
      expect.objectContaining({
        moduleNumber: "02",
        moduleName: "POS / SALES",
        href: "/pos",
      }),
    ]);
  });
});
