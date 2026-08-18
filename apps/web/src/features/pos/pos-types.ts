import type { PosCartLine, PosPriceLevel } from "@electronic-erp/domain";

export type PriceLevel = PosPriceLevel;
export type CartLine = PosCartLine;
export type PaySplit = {
  id: string;
  paymentMethodId: string;
  amount: string;
  /** Cash tendered when method is cash. */
  amountReceived?: string;
  methodKind?: string;
};
export type LocaleMode = "en" | "ur" | "en_ur";
export type PosMode = "easy" | "advanced";
export type ProductTab = "recent" | "favorites" | "categories" | "results";

export function uuid() {
  return crypto.randomUUID();
}

export const POS_SHORTCUTS = [
  { key: "F1", label: "New Sale", action: "new-sale" },
  { key: "F2", label: "Hold / Resume", action: "hold-resume" },
  { key: "F3", label: "Customers", action: "customers" },
  { key: "F4", label: "Price Override", action: "price-override" },
  { key: "F5", label: "Discount", action: "discount" },
  { key: "F6", label: "Recalculate", action: "recalculate" },
  { key: "F7", label: "Clear Cart", action: "clear-cart" },
  { key: "F8", label: "Cancel Sale", action: "cancel-sale" },
] as const;

export type PosShortcutAction = (typeof POS_SHORTCUTS)[number]["action"];

/** Operational keys shown in Settings. The bottom bar shows F1–F8 only. */
export const POS_OPERATIONAL_SHORTCUTS = [
  { key: "Enter", label: "Add scanned / highlighted product" },
  { key: "Escape", label: "Close dialog or clear search" },
  { key: "+ / −", label: "Last line quantity (when not typing)" },
  { key: "↑ / ↓", label: "Move through products, cart lines, and lists" },
] as const;

export const POS_SHORTCUT_EVENT = "pos:shortcut";
