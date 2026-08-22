import type { ProductSearchResult } from "@electronic-erp/contracts";

export type ProductTab = "recent" | "favorites" | "categories";

export type PosPaymentKind =
  | "cash"
  | "card"
  | "bank"
  | "jazzcash"
  | "easypaisa"
  | "sadapay"
  | "wallet"
  | "credit"
  | "installment";

export interface CartLine {
  id: string;
  productId: string;
  name: string;
  sku: string;
  unitId: string;
  unitLabel: string;
  qty: number;
  rate: number;
  discount: number;
  tax: number;
  imageUrl?: string | null;
}

export interface PosCustomerView {
  id: string | null;
  label: string;
  priceTier: string;
  creditLimit: number;
  outstanding: number;
  loyaltyPoints: number;
}

export interface PosDrawerSummary {
  opening: string;
  inHand: string;
  sales: string;
  expenses: string;
  expected: string;
}

export interface PosShortcutAction {
  key: string;
  label: string;
  fnKey: string;
}

export const POS_SHORTCUTS: PosShortcutAction[] = [
  { key: "new-sale", label: "New Sale", fnKey: "F1" },
  { key: "hold-resume", label: "Hold / Resume", fnKey: "F2" },
  { key: "customers", label: "Customers", fnKey: "F3" },
  { key: "price-override", label: "Price Override", fnKey: "F4" },
  { key: "discount", label: "Discount", fnKey: "F5" },
  { key: "recalculate", label: "Recalculate", fnKey: "F6" },
  { key: "clear-cart", label: "Clear Cart", fnKey: "F7" },
  { key: "cancel-sale", label: "Cancel Sale", fnKey: "F8" },
];

export const PAYMENT_METHODS: Array<{ id: PosPaymentKind; label: string; icon: string; color: string }> = [
  { id: "cash", label: "Cash", icon: "fa-money-bill-wave", color: "text-emerald-600" },
  { id: "card", label: "Card", icon: "fa-credit-card", color: "text-blue-600" },
  { id: "bank", label: "Bank Transfer", icon: "fa-building-columns", color: "text-indigo-600" },
  { id: "jazzcash", label: "JazzCash", icon: "fa-wallet", color: "text-red-500" },
  { id: "easypaisa", label: "Easypaisa", icon: "fa-circle-dollar-to-slot", color: "text-emerald-500" },
  { id: "sadapay", label: "SadaPay", icon: "fa-circle-nodes", color: "text-purple-500" },
  { id: "wallet", label: "Other Wallet", icon: "fa-wallet", color: "text-blue-500" },
  { id: "credit", label: "Credit / Udhar", icon: "fa-hand-holding-dollar", color: "text-amber-600" },
  { id: "installment", label: "Installment", icon: "fa-calendar", color: "text-gray-500" },
];

export function productFromSearch(p: ProductSearchResult): ProductSearchResult {
  return p;
}

export function emptyCustomer(): PosCustomerView {
  return {
    id: null,
    label: "Walk-in Customer",
    priceTier: "Retail",
    creditLimit: 0,
    outstanding: 0,
    loyaltyPoints: 0,
  };
}
