import { describe, expect, it } from "vitest";
import {
  POS_DESKTOP_MIN,
  POS_TEST_WIDTHS,
  posLayoutMode,
  posSaleChrome,
  posSaleLayoutClass,
  posShowsSplitRegister,
  posShowsTwoZoneTerminal,
  posTabletStacks,
  posUsesMobileSheets,
  posSidebarCollapsedByDefault,
} from "./pos-layout";

describe("POS responsive layout modes", () => {
  it("classifies common register widths without shrinking the desktop terminal", () => {
    expect(POS_TEST_WIDTHS).toEqual([375, 390, 768, 820, 1024, 1280, 1366, 1440, 1920]);
    expect(posLayoutMode(375)).toBe("mobile");
    expect(posLayoutMode(390)).toBe("mobile");
    expect(posLayoutMode(767)).toBe("mobile");
    expect(posLayoutMode(768)).toBe("tablet");
    expect(posLayoutMode(820)).toBe("tablet");
    expect(posLayoutMode(1024)).toBe("tablet");
    expect(posLayoutMode(1279)).toBe("tablet");
    expect(posLayoutMode(POS_DESKTOP_MIN)).toBe("desktop");
    expect(posLayoutMode(1440)).toBe("desktop");
    expect(posLayoutMode(1920)).toBe("desktop");
    expect(posLayoutMode(1366)).toBe("desktop");
    expect(posSidebarCollapsedByDefault("desktop")).toBe(false);
    expect(posSidebarCollapsedByDefault("tablet")).toBe(true);
    expect(posSidebarCollapsedByDefault("mobile")).toBe(true);
  });

  it("keeps a two-zone terminal from 1024px and stacks only when the cart would fall off-screen", () => {
    expect(posShowsTwoZoneTerminal(1024)).toBe(true);
    expect(posShowsTwoZoneTerminal(1280)).toBe(true);
    expect(posTabletStacks(768)).toBe(true);
    expect(posTabletStacks(820)).toBe(true);
    expect(posTabletStacks(1024)).toBe(false);
    expect(posUsesMobileSheets(375)).toBe(true);
    expect(posUsesMobileSheets(768)).toBe(false);
    expect(posUsesMobileSheets(1280)).toBe(false);
    expect(posSaleChrome(375)).toBe("sheets");
    expect(posSaleChrome(767)).toBe("sheets");
    expect(posSaleChrome(768)).toBe("stack");
    expect(posSaleChrome(820)).toBe("stack");
    expect(posSaleChrome(1023)).toBe("stack");
    expect(posSaleChrome(1024)).toBe("split");
    expect(posSaleChrome(1366)).toBe("split");
    expect(posShowsTwoZoneTerminal(1366)).toBe(true);
    expect(posSaleLayoutClass("sheets")).toBe("pos-sale-mobile");
    expect(posSaleLayoutClass("stack")).toContain("pos-sale-grid--stack");
    expect(posSaleLayoutClass("split")).toBe("pos-sale-grid");
    expect(posShowsSplitRegister(1024)).toBe(true);
    expect(posShowsSplitRegister(820)).toBe(false);
  });
});
