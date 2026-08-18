/** Layout breakpoints for the POS terminal. No sale or payment logic. */

export const POS_MOBILE_MAX = 767;
export const POS_TABLET_MIN = 768;
export const POS_TABLET_WIDE_MIN = 1024;
export const POS_DESKTOP_MIN = 1280;

export type PosLayoutMode = "desktop" | "tablet" | "mobile";
export type PosMobileSheet = "cart" | "customer" | "pay" | null;
export type PosSaleChrome = "sheets" | "stack" | "split";

/** Common register widths used to lock layout behavior. */
export const POS_TEST_WIDTHS = [375, 390, 768, 820, 1024, 1280, 1440, 1920] as const;

export function posLayoutMode(width: number): PosLayoutMode {
  if (width >= POS_DESKTOP_MIN) return "desktop";
  if (width >= POS_TABLET_MIN) return "tablet";
  return "mobile";
}

/** Large tablets keep a two-zone terminal; narrower tablets stack with the cart still on-screen. */
export function posTabletStacks(width: number): boolean {
  return width >= POS_TABLET_MIN && width < POS_TABLET_WIDE_MIN;
}

export function posShowsTwoZoneTerminal(width: number): boolean {
  return width >= POS_TABLET_WIDE_MIN;
}

export function posUsesMobileSheets(width: number): boolean {
  return posLayoutMode(width) === "mobile";
}

export function posSaleChrome(width: number): PosSaleChrome {
  if (posUsesMobileSheets(width)) return "sheets";
  if (posTabletStacks(width)) return "stack";
  return "split";
}

export function posSaleLayoutClass(chrome: PosSaleChrome): string {
  if (chrome === "sheets") return "pos-sale-mobile";
  if (chrome === "stack") return "pos-sale-grid pos-sale-grid--stack";
  return "pos-sale-grid";
}

/** Split registers (holds, payments, installments) follow the two-zone breakpoint. */
export function posShowsSplitRegister(width: number): boolean {
  return posShowsTwoZoneTerminal(width);
}

/** Tablet and mobile collapse the dedicated POS sidebar; desktop keeps it open. */
export function posSidebarCollapsedByDefault(mode: PosLayoutMode): boolean {
  return mode !== "desktop";
}

export const POS_TERMINAL_STORAGE_KEY = "erp_pos_terminal_id";
