import { ValidationDomainError } from "./errors.js";

/** Held bill lifecycle statuses stored in DB. */
export type HeldSaleStatus = "held" | "resumed" | "expired" | "cancelled" | "discarded";

/** UI / query buckets for pending holds. */
export type HeldSaleFilter =
  | "active"
  | "expiring"
  | "expired"
  | "today"
  | "mine"
  | "all_pending";

export type HeldSaleAction =
  | "resume"
  | "resume_and_checkout"
  | "edit"
  | "duplicate"
  | "transfer"
  | "cancel"
  | "discard";

/** Default hold TTL — abandoned holds auto-expire after this window. */
export const DEFAULT_HOLD_TTL_MS = 24 * 60 * 60 * 1000;

/** Holds within this window of expiry are classified as "expiring". */
export const DEFAULT_HOLD_EXPIRING_WINDOW_MS = 2 * 60 * 60 * 1000;

export type HeldSaleRecord = {
  id: string;
  organizationId: string;
  branchId: string;
  saleId: string;
  holdLabel: string | null;
  holdReason: string | null;
  notes: string | null;
  heldBy: string | null;
  customerId: string | null;
  customerName?: string | null;
  cartSnapshot: Record<string, unknown>;
  heldAt: string;
  expiresAt: string | null;
  resumedAt?: string | null;
  status: HeldSaleStatus;
  deviceId?: string | null;
};

export type HeldSaleLifecycleView = HeldSaleRecord & {
  bucket: "active" | "expiring" | "expired" | "closed";
  cartItemCount: number;
  isExpired: boolean;
  minutesUntilExpiry: number | null;
};

export function computeHoldExpiresAt(
  heldAt: string | Date,
  ttlMs: number = DEFAULT_HOLD_TTL_MS,
): string {
  const start = typeof heldAt === "string" ? new Date(heldAt) : heldAt;
  return new Date(start.getTime() + ttlMs).toISOString();
}

export function cartItemCountFromSnapshot(snapshot: Record<string, unknown>): number {
  const cart = snapshot.cart;
  return Array.isArray(cart) ? cart.length : 0;
}

export function assertHoldCartNonEmpty(snapshot: Record<string, unknown>): void {
  if (cartItemCountFromSnapshot(snapshot) < 1) {
    throw new ValidationDomainError("Cannot hold an empty cart");
  }
}

/**
 * Holds park a cart snapshot only — they must never post stock movements.
 * Call sites use this as a documented invariant for tests and reviews.
 */
export function holdMustNotReduceInventory(): true {
  return true;
}

export function classifyHeldSale(
  hold: Pick<HeldSaleRecord, "status" | "heldAt" | "expiresAt">,
  now: Date = new Date(),
  expiringWindowMs: number = DEFAULT_HOLD_EXPIRING_WINDOW_MS,
): HeldSaleLifecycleView["bucket"] {
  if (hold.status === "expired") return "expired";
  if (hold.status === "resumed" || hold.status === "cancelled" || hold.status === "discarded") {
    return "closed";
  }
  const expiresAt = hold.expiresAt ? new Date(hold.expiresAt) : null;
  if (expiresAt && expiresAt.getTime() <= now.getTime()) return "expired";
  if (expiresAt && expiresAt.getTime() - now.getTime() <= expiringWindowMs) return "expiring";
  return "active";
}

export function enrichHeldSale(
  hold: HeldSaleRecord,
  now: Date = new Date(),
): HeldSaleLifecycleView {
  const bucket = classifyHeldSale(hold, now);
  const expiresAt = hold.expiresAt ? new Date(hold.expiresAt) : null;
  const minutesUntilExpiry =
    expiresAt && bucket !== "expired" && bucket !== "closed"
      ? Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 60000))
      : null;
  return {
    ...hold,
    bucket: bucket === "expired" && hold.status === "held" ? "expired" : bucket,
    cartItemCount: cartItemCountFromSnapshot(hold.cartSnapshot),
    isExpired: bucket === "expired",
    minutesUntilExpiry,
  };
}

export function filterHeldSales(
  holds: HeldSaleRecord[],
  filter: HeldSaleFilter,
  opts: { userId?: string | null; now?: Date } = {},
): HeldSaleLifecycleView[] {
  const now = opts.now ?? new Date();
  const enriched = holds.map((h) => enrichHeldSale(h, now));
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  switch (filter) {
    case "active":
      return enriched.filter((h) => h.status === "held" && h.bucket === "active");
    case "expiring":
      return enriched.filter((h) => h.status === "held" && h.bucket === "expiring");
    case "expired":
      return enriched.filter(
        (h) => h.status === "expired" || (h.status === "held" && h.bucket === "expired"),
      );
    case "today":
      return enriched.filter(
        (h) =>
          (h.status === "held" || h.status === "expired") &&
          new Date(h.heldAt).getTime() >= startOfToday.getTime(),
      );
    case "mine":
      if (!opts.userId) return [];
      return enriched.filter(
        (h) =>
          h.heldBy === opts.userId &&
          (h.status === "held" || h.status === "expired"),
      );
    case "all_pending":
      return enriched.filter((h) => h.status === "held" || h.status === "expired");
    default:
      return enriched;
  }
}

/** Holds that are still "held" but past expires_at — ready for DB status flip. */
export function holdsDueForExpiry(
  holds: HeldSaleRecord[],
  now: Date = new Date(),
): HeldSaleRecord[] {
  return holds.filter((h) => {
    if (h.status !== "held") return false;
    if (!h.expiresAt) return false;
    return new Date(h.expiresAt).getTime() <= now.getTime();
  });
}

const ACTIONABLE_FROM: Record<HeldSaleAction, HeldSaleStatus[]> = {
  resume: ["held"],
  resume_and_checkout: ["held"],
  edit: ["held"],
  duplicate: ["held", "expired", "cancelled", "discarded", "resumed"],
  transfer: ["held"],
  cancel: ["held"],
  discard: ["held", "expired"],
};

export function assertHoldActionAllowed(
  hold: Pick<HeldSaleRecord, "status" | "expiresAt" | "heldBy">,
  action: HeldSaleAction,
  opts: { now?: Date; actorUserId?: string | null; resumeAny?: boolean } = {},
): void {
  const now = opts.now ?? new Date();
  const allowed = ACTIONABLE_FROM[action];
  if (!allowed.includes(hold.status)) {
    throw new ValidationDomainError(
      `Cannot ${action.replace(/_/g, " ")} hold in status ${hold.status}`,
    );
  }
  if (
    (action === "resume" || action === "resume_and_checkout" || action === "edit" || action === "transfer") &&
    hold.status === "held" &&
    hold.expiresAt &&
    new Date(hold.expiresAt).getTime() <= now.getTime()
  ) {
    throw new ValidationDomainError("Hold has expired — discard or duplicate instead");
  }
  if (
    (action === "resume" ||
      action === "resume_and_checkout" ||
      action === "edit" ||
      action === "transfer" ||
      action === "cancel" ||
      action === "discard") &&
    hold.heldBy &&
    opts.actorUserId &&
    hold.heldBy !== opts.actorUserId &&
    !opts.resumeAny
  ) {
    throw new ValidationDomainError("Hold belongs to another cashier");
  }
}

/**
 * Restore cart from hold: always replace, never append — prevents duplicate lines.
 */
export function cartLinesForResume(snapshot: Record<string, unknown>): unknown[] {
  const cart = snapshot.cart;
  if (!Array.isArray(cart)) {
    throw new ValidationDomainError("Held cart snapshot is missing cart lines");
  }
  return [...cart];
}

/** Snapshot schema version stamped on new holds. */
export const HOLD_SNAPSHOT_VERSION = 1;

/**
 * Full New Sale transaction state parked on a hold.
 * Resume must restore these fields so checkout matches the held bill.
 */
export type HoldTransactionTotals = {
  items: number;
  qty: number;
  subtotal: number;
  itemDiscount: number;
  invoiceDiscount: number;
  discount: number;
  tax: number;
  grand: number;
  taxableAmount: number;
};

export type HoldTransactionSnapshot = {
  version: number;
  cart: unknown[];
  customerId: string;
  customerName: string | null;
  walkIn: boolean;
  invoiceDiscount: string;
  invoiceDiscountKind: "fixed" | "percentage";
  invoiceDiscountPercent: number;
  notes: string;
  payments: unknown[];
  cashReceived: string;
  delivery: boolean;
  priceLevel: string;
  salesmanUserId: string;
  commissionPercent: number;
  referenceId: string;
  locale: string;
  mode: string;
  useInstallment: boolean;
  installmentCount: string;
  downPayment: string;
  installmentFrequency: string;
  lateFeePercent: string;
  lateFeeFixed: string;
  isAdvance: boolean;
  heldAtClient: string;
  totals: HoldTransactionTotals | null;
};

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}

function asNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/**
 * Build the cart_snapshot written to held_sales.
 * Parks exact line economics + session payment/discount state — never posts stock.
 */
export function buildHoldSnapshot(input: {
  cart: unknown[];
  customerId?: string | null;
  customerName?: string | null;
  walkIn?: boolean;
  invoiceDiscount?: string;
  invoiceDiscountKind?: "fixed" | "percentage";
  invoiceDiscountPercent?: number;
  notes?: string;
  payments?: unknown[];
  cashReceived?: string;
  delivery?: boolean;
  priceLevel?: string;
  salesmanUserId?: string | null;
  commissionPercent?: number;
  referenceId?: string | null;
  locale?: string;
  mode?: string;
  useInstallment?: boolean;
  installmentCount?: string;
  downPayment?: string;
  installmentFrequency?: string;
  lateFeePercent?: string;
  lateFeeFixed?: string;
  isAdvance?: boolean;
  totals?: HoldTransactionTotals | null;
  [key: string]: unknown;
}): Record<string, unknown> {
  const snapshot: HoldTransactionSnapshot = {
    version: HOLD_SNAPSHOT_VERSION,
    cart: input.cart,
    customerId: asString(input.customerId ?? ""),
    customerName:
      typeof input.customerName === "string" && input.customerName.trim()
        ? input.customerName.trim()
        : null,
    walkIn: Boolean(input.walkIn),
    invoiceDiscount: asString(input.invoiceDiscount ?? "0", "0"),
    invoiceDiscountKind: input.invoiceDiscountKind === "percentage" ? "percentage" : "fixed",
    invoiceDiscountPercent: asNumber(input.invoiceDiscountPercent, 0),
    notes: asString(input.notes ?? ""),
    payments: Array.isArray(input.payments) ? input.payments : [],
    cashReceived: asString(input.cashReceived ?? ""),
    delivery: Boolean(input.delivery),
    priceLevel: asString(input.priceLevel ?? "retail", "retail"),
    salesmanUserId: asString(input.salesmanUserId ?? ""),
    commissionPercent: asNumber(input.commissionPercent, 0),
    referenceId: asString(input.referenceId ?? ""),
    locale: asString(input.locale ?? "en", "en"),
    mode: asString(input.mode ?? "easy", "easy"),
    useInstallment: Boolean(input.useInstallment),
    installmentCount: asString(input.installmentCount ?? "3", "3"),
    downPayment: asString(input.downPayment ?? "0", "0"),
    installmentFrequency: asString(input.installmentFrequency ?? "monthly", "monthly"),
    lateFeePercent: asString(input.lateFeePercent ?? "0", "0"),
    lateFeeFixed: asString(input.lateFeeFixed ?? "0", "0"),
    isAdvance: Boolean(input.isAdvance),
    heldAtClient: new Date().toISOString(),
    totals: input.totals ?? null,
  };
  assertHoldCartNonEmpty(snapshot as unknown as Record<string, unknown>);
  return snapshot as unknown as Record<string, unknown>;
}

/**
 * Parse a parked cart_snapshot into a typed restore payload.
 * Older snapshots missing fields get safe defaults; cart lines are always replaced.
 */
export function restoreHoldTransaction(snapshot: Record<string, unknown>): HoldTransactionSnapshot {
  const cart = cartLinesForResume(snapshot);
  const kind = snapshot.invoiceDiscountKind === "percentage" ? "percentage" : "fixed";
  const totalsRaw = snapshot.totals;
  let totals: HoldTransactionTotals | null = null;
  if (totalsRaw && typeof totalsRaw === "object") {
    const t = totalsRaw as Record<string, unknown>;
    totals = {
      items: asNumber(t.items),
      qty: asNumber(t.qty),
      subtotal: asNumber(t.subtotal),
      itemDiscount: asNumber(t.itemDiscount),
      invoiceDiscount: asNumber(t.invoiceDiscount),
      discount: asNumber(t.discount),
      tax: asNumber(t.tax),
      grand: asNumber(t.grand),
      taxableAmount: asNumber(t.taxableAmount),
    };
  }
  return {
    version: asNumber(snapshot.version, 0),
    cart,
    customerId: asString(snapshot.customerId ?? ""),
    customerName:
      typeof snapshot.customerName === "string" && snapshot.customerName.trim()
        ? snapshot.customerName.trim()
        : null,
    walkIn: asBool(snapshot.walkIn, !asString(snapshot.customerId ?? "")),
    invoiceDiscount: asString(snapshot.invoiceDiscount ?? "0", "0"),
    invoiceDiscountKind: kind,
    invoiceDiscountPercent: asNumber(snapshot.invoiceDiscountPercent, 0),
    notes: asString(snapshot.notes ?? ""),
    payments: Array.isArray(snapshot.payments) ? snapshot.payments : [],
    cashReceived: asString(snapshot.cashReceived ?? ""),
    delivery: asBool(snapshot.delivery),
    priceLevel: asString(snapshot.priceLevel ?? "retail", "retail"),
    salesmanUserId: asString(snapshot.salesmanUserId ?? ""),
    commissionPercent: asNumber(snapshot.commissionPercent, 0),
    referenceId: asString(snapshot.referenceId ?? ""),
    locale: asString(snapshot.locale ?? "en", "en"),
    mode: asString(snapshot.mode ?? "easy", "easy"),
    useInstallment: asBool(snapshot.useInstallment),
    installmentCount: asString(snapshot.installmentCount ?? "3", "3"),
    downPayment: asString(snapshot.downPayment ?? "0", "0"),
    installmentFrequency: asString(snapshot.installmentFrequency ?? "monthly", "monthly"),
    lateFeePercent: asString(snapshot.lateFeePercent ?? "0", "0"),
    lateFeeFixed: asString(snapshot.lateFeeFixed ?? "0", "0"),
    isAdvance: asBool(snapshot.isAdvance),
    heldAtClient: asString(snapshot.heldAtClient ?? ""),
    totals,
  };
}

export function nextStatusForAction(action: HeldSaleAction): HeldSaleStatus | null {
  switch (action) {
    case "resume":
    case "resume_and_checkout":
      return "resumed";
    case "cancel":
      return "cancelled";
    case "discard":
      return "discarded";
    default:
      return null;
  }
}

export function statusAfterExpiry(): HeldSaleStatus {
  return "expired";
}
