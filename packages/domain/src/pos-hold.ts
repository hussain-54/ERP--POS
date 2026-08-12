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
    (action === "resume" || action === "resume_and_checkout" || action === "edit" || action === "transfer") &&
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

export function buildHoldSnapshot(input: {
  cart: unknown[];
  customerId?: string | null;
  walkIn?: boolean;
  invoiceDiscount?: string;
  notes?: string;
  payments?: unknown[];
  [key: string]: unknown;
}): Record<string, unknown> {
  const snapshot = {
    ...input,
    cart: input.cart,
    heldAtClient: new Date().toISOString(),
  };
  assertHoldCartNonEmpty(snapshot);
  return snapshot;
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
