import type { ApproverRole, ProductSearchResult } from "@electronic-erp/contracts";
import {
  canPosPriceOverride,
  posDiscountRoleFromPermissions,
} from "@electronic-erp/domain";

export type ProductTab = "all" | "recent" | "favorites" | "categories";

export type PosPaymentKind =
  | "cash"
  | "card"
  | "bank"
  | "qr"
  | "jazzcash"
  | "easypaisa"
  | "sadapay"
  | "wallet"
  | "credit"
  | "installment"
  | "split"
  | "partial";

export type DiscountScope = "item" | "invoice";
export type DiscountMode = "percentage" | "fixed" | "coupon" | "promotion";

export interface CartLine {
  id: string;
  productId: string;
  name: string;
  sku: string;
  unitId: string;
  unitLabel: string;
  qty: number;
  rate: number;
  /** Original catalog rate before override. */
  listPrice: number;
  discount: number;
  discountPercent: number;
  tax: number;
  taxRate: number;
  imageUrl?: string | null;
  stockAvailable?: number | null;
  category?: string | null;
  /** Ad-hoc line not tied to catalog product. */
  isManual?: boolean;
}

export interface PosCustomerView {
  id: string | null;
  label: string;
  priceTier: string;
  creditLimit: number;
  outstanding: number;
  loyaltyPoints: number;
  mobile?: string | null;
  email?: string | null;
}

export interface PosDrawerSummary {
  opening: string;
  inHand: string;
  sales: string;
  expenses: string;
  expected: string;
}

export interface PosPaymentLine {
  kind: PosPaymentKind;
  paymentMethodId: string | null;
  amount: number;
  amountReceived?: number;
  reference?: string;
}

export interface PosShortcutAction {
  key: string;
  label: string;
  fnKey: string;
}

export const POS_SHORTCUTS: PosShortcutAction[] = [
  { key: "new-sale", label: "New Sale", fnKey: "F1" },
  { key: "pay", label: "Pay", fnKey: "F2" },
  { key: "customers", label: "Customers", fnKey: "F3 / F8" },
  { key: "hold", label: "Hold", fnKey: "F4" },
  { key: "discount", label: "Discount", fnKey: "F5" },
  { key: "delivery", label: "Delivery", fnKey: "F6" },
  { key: "clear-cart", label: "Clear Cart", fnKey: "F7 / Esc" },
];

export const PAYMENT_METHODS: Array<{
  id: PosPaymentKind;
  label: string;
  icon: string;
  color: string;
  recordOnly?: boolean;
}> = [
  { id: "cash", label: "Cash", icon: "fa-money-bill-wave", color: "text-emerald-600" },
  { id: "card", label: "Card", icon: "fa-credit-card", color: "text-blue-600", recordOnly: true },
  { id: "bank", label: "Bank Transfer", icon: "fa-building-columns", color: "text-indigo-600", recordOnly: true },
  { id: "qr", label: "QR Payment", icon: "fa-qrcode", color: "text-slate-600", recordOnly: true },
  { id: "jazzcash", label: "JazzCash", icon: "fa-wallet", color: "text-red-500", recordOnly: true },
  { id: "easypaisa", label: "Easypaisa", icon: "fa-circle-dollar-to-slot", color: "text-emerald-500", recordOnly: true },
  { id: "sadapay", label: "SadaPay", icon: "fa-circle-nodes", color: "text-purple-500", recordOnly: true },
  { id: "wallet", label: "Other Wallet", icon: "fa-wallet", color: "text-blue-500", recordOnly: true },
  { id: "split", label: "Split", icon: "fa-scissors", color: "text-cyan-600" },
  { id: "partial", label: "Partial", icon: "fa-chart-pie", color: "text-orange-500" },
  { id: "credit", label: "Credit / Udhaar", icon: "fa-hand-holding-dollar", color: "text-amber-600" },
  { id: "installment", label: "Installment", icon: "fa-calendar", color: "text-gray-500" },
];

export function emptyCustomer(): PosCustomerView {
  return {
    id: null,
    label: "Walk-in Customer",
    priceTier: "Retail",
    creditLimit: 0,
    outstanding: 0,
    loyaltyPoints: 0,
    mobile: null,
    email: null,
  };
}

export function lineTotal(line: CartLine): number {
  return Math.max(0, line.qty * line.rate - line.discount);
}

export function actingDiscountRole(permissions: string[]): ApproverRole {
  return posDiscountRoleFromPermissions(permissions) ?? "cashier";
}

export function canOverridePrice(permissions: string[]): boolean {
  return canPosPriceOverride(permissions);
}

export function productFromSearch(p: ProductSearchResult): ProductSearchResult {
  return p;
}

/** Map UI tender kind → seeded payment_methods.kind */
export function tenderToMethodKind(kind: PosPaymentKind): string {
  if (kind === "qr" || kind === "wallet" || kind === "split" || kind === "partial") return "online";
  return kind;
}
