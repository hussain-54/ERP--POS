import {
  DEFAULT_HOLD_EXPIRING_WINDOW_MS,
  DEFAULT_HOLD_TTL_MS,
  DISCOUNT_LIMITS,
  REFUND_METHODS,
  RETURN_DISPOSITIONS,
  RETURN_REASON_CODES,
} from "@electronic-erp/domain";
import { SYSTEM_PAYMENT_METHOD_KINDS } from "@electronic-erp/contracts";
import { defaultMediaForDocument } from "@electronic-erp/hardware";
import { POS_OPERATIONAL_SHORTCUTS, POS_SHORTCUTS } from "./pos-types";
import type { POSBadgeTone } from "./design-system";

export const POS_SETTINGS_HEADING = "Settings";

export const POS_SETTINGS_SECTIONS = [
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
] as const;

export type PosSettingsSection = (typeof POS_SETTINGS_SECTIONS)[number];

export const POS_SETTINGS_COLUMNS = ["Setting", "Value", "Status"] as const;

/** ERP System Administration surfaces — do not list these as POS settings. */
export const POS_SETTINGS_EXCLUDED_ERP = [
  "Security",
  "Users",
  "Branches",
  "Integrations",
  "Backup",
  "Company settings",
] as const;

export type PosSettingStatus = "active" | "coming-soon";

export type PosSettingRow = {
  name: string;
  value: string;
  status: PosSettingStatus;
};

export function posSettingStatusTone(status: PosSettingStatus): POSBadgeTone {
  return status === "active" ? "success" : "warning";
}

export function posSettingStatusLabel(status: PosSettingStatus): string {
  return status === "active" ? "Active" : "Coming Soon";
}

function hoursFromMs(ms: number): string {
  return `${ms / (60 * 60 * 1000)} hours`;
}

function active(name: string, value: string): PosSettingRow {
  return { name, value, status: "active" };
}

function soon(name: string, value = "Not in backend"): PosSettingRow {
  return { name, value, status: "coming-soon" };
}

export function buildPosSettingsCatalog(): Record<PosSettingsSection, PosSettingRow[]> {
  return {
    "POS Terminal": [
      active("Runtime", "Online-only Supabase. No offline POS queue."),
      active("Hardware bridge", "HardwareService — USB wedge scanner, memory printers, cash drawer"),
      active("Cash drawer", "POST /api/v1/hardware/cash-drawer/open (cash_drawer.open)"),
      active("Shift / register", "Open and close on Register via existing shift APIs"),
      soon("Default printer assignment"),
    ],
    Receipt: [
      active("80mm receipt", "receipt_80 — New Sale preview and thermal print"),
      active("58mm receipt", "receipt_58 — New Sale preview and thermal print"),
      active("Sales invoice default media", defaultMediaForDocument("sales_invoice")),
      active("Payment receipt default media", defaultMediaForDocument("payment_receipt")),
      soon("Custom logo, header, and footer"),
    ],
    Invoice: [
      active("Numbering", "Assigned on sale post (INV-…). No numbering-series table."),
      active("Reprint formats", "print_a4, print_80mm, print_58mm"),
      active("Share actions", "save, download_pdf, whatsapp, email"),
      soon("Invoice template designer"),
      soon("Configurable document series"),
    ],
    Payments: [
      active("Method catalog", SYSTEM_PAYMENT_METHOD_KINDS.join(", ")),
      active("Live methods", "GET /api/v1/parties/payment-methods"),
      active("Gateway", "None. Card and wallet kinds are stored locally."),
      soon("Payment gateway"),
    ],
    Tax: [
      active("Line tax", "pos-tax.ts — exclusive add-on or inclusive extract"),
      active("Rate source", "GET /api/v1/tax/rates (default/active rate on New Sale)"),
      active("Exempt", "is_exempt rates post zero tax"),
      soon("POS-only tax override"),
    ],
    Discounts: [
      active("Cashier cap", `${DISCOUNT_LIMITS.cashier}%`),
      active("Supervisor cap", `${DISCOUNT_LIMITS.supervisor}%`),
      active("Manager cap", `${DISCOUNT_LIMITS.manager}%`),
      active("Owner cap", `${DISCOUNT_LIMITS.owner}%`),
      active("Special cap", "Unlimited"),
      active("Approvals", "Real admin approval inbox on Discounts"),
      soon("Editable discount caps"),
    ],
    Barcode: [
      active("Scan input", "USB / HID keyboard-wedge on New Sale"),
      active("Normalize", "Trim, max 64 characters (barcode.ts)"),
      active("SKU barcode", "Alphanumeric Code128-friendly payload from SKU"),
      soon("Camera scanner host capture"),
    ],
    "Keyboard Shortcuts": POS_SHORTCUTS.map((row) => active(row.key, row.label)).concat(
      POS_OPERATIONAL_SHORTCUTS.map((row) => active(row.key, row.label)),
      [soon("Custom key remapping")],
    ),
    Customer: [
      active("Walk-in", "Allowed without a customer record"),
      active("Price level", "retail / wholesale / dealer from customer type"),
      active("Blocked customers", "Cannot be sold to"),
      active("CNIC", "Masked on the POS profile"),
      soon("Require customer on every sale"),
    ],
    Sales: [
      active("Modes", "easy, advanced (stored on the sale)"),
      active("Locale", "en, ur, en_ur (stored on the sale)"),
      active("Hold TTL", hoursFromMs(DEFAULT_HOLD_TTL_MS)),
      active("Hold expiring window", hoursFromMs(DEFAULT_HOLD_EXPIRING_WINDOW_MS)),
      soon("Persisted default mode and locale"),
    ],
    Returns: [
      active("Qty cap", "Sold minus previously returned"),
      active("Reasons", RETURN_REASON_CODES.join(", ")),
      active("Dispositions", RETURN_DISPOSITIONS.join(", ")),
      active("Refund methods", REFUND_METHODS.join(", ")),
      soon("Configurable restock default"),
    ],
    Display: [
      active("Terminal chrome", "POSShell tokens — dense New Sale, workspace pages"),
      active("RTL", "Urdu locale sets dir=rtl on New Sale"),
      soon("Saved theme and density"),
    ],
  };
}
