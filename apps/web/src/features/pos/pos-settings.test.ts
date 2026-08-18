import { describe, expect, it } from "vitest";
import { DISCOUNT_LIMITS, DEFAULT_HOLD_TTL_MS } from "@electronic-erp/domain";
import { defaultMediaForDocument } from "@electronic-erp/hardware";
import { POS_SHORTCUTS } from "./pos-types";
import {
  buildPosSettingsCatalog,
  POS_SETTINGS_EXCLUDED_ERP,
  POS_SETTINGS_HEADING,
  POS_SETTINGS_SECTIONS,
  posSettingStatusLabel,
} from "./pos-settings";

describe("POS settings catalog", () => {
  it("locks the heading and twelve POS-only sections", () => {
    expect(POS_SETTINGS_HEADING).toBe("Settings");
    expect([...POS_SETTINGS_SECTIONS]).toEqual([
      "POS Terminal",
      "Receipt",
      "Invoice",
      "Payments",
      "Tax",
      "Discounts",
      "Barcode",
      "Keyboard Shortcuts",
      "Customer",
      "Sales",
      "Returns",
      "Display",
    ]);
    const catalog = buildPosSettingsCatalog();
    expect(Object.keys(catalog)).toEqual([...POS_SETTINGS_SECTIONS]);
    for (const name of POS_SETTINGS_EXCLUDED_ERP) {
      expect(POS_SETTINGS_SECTIONS as readonly string[]).not.toContain(name);
    }
  });

  it("surfaces real domain, hardware, and shortcut config without inventing writers", () => {
    const catalog = buildPosSettingsCatalog();
    expect(catalog.Receipt.find((row) => row.name === "Sales invoice default media")?.value).toBe(
      defaultMediaForDocument("sales_invoice"),
    );
    expect(catalog.Discounts.find((row) => row.name === "Cashier cap")?.value).toBe(
      `${DISCOUNT_LIMITS.cashier}%`,
    );
    expect(catalog.Sales.find((row) => row.name === "Hold TTL")?.value).toBe(
      `${DEFAULT_HOLD_TTL_MS / (60 * 60 * 1000)} hours`,
    );
    for (const shortcut of POS_SHORTCUTS) {
      expect(catalog["Keyboard Shortcuts"].some((row) => row.name === shortcut.key && row.value === shortcut.label)).toBe(
        true,
      );
    }
    expect(catalog.Payments.find((row) => row.name === "Gateway")?.value).toMatch(/None/);
    expect(catalog.Invoice.find((row) => row.name === "Configurable document series")?.status).toBe(
      "coming-soon",
    );
    expect(posSettingStatusLabel("coming-soon")).toBe("Coming Soon");
  });
});
