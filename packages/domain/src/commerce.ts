import type {
  CampaignChannel,
  CreateSegmentInput,
  LoyaltyTierCode,
  PriceBook,
  StoreCheckoutInput,
} from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";

export const DEFAULT_LOYALTY_TIERS: Array<{
  code: LoyaltyTierCode;
  name: string;
  minPoints: number;
  earnRate: number;
  redeemRate: number;
}> = [
  { code: "silver", name: "Silver", minPoints: 0, earnRate: 1, redeemRate: 1 },
  { code: "gold", name: "Gold", minPoints: 1000, earnRate: 1.25, redeemRate: 1 },
  { code: "platinum", name: "Platinum", minPoints: 5000, earnRate: 1.5, redeemRate: 1.1 },
];

function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Points earned from a purchase amount at tier earn rate (1 point per PKR * rate). */
export function calculateEarnPoints(purchaseAmount: number, earnRate: number): number {
  if (purchaseAmount <= 0) return 0;
  return Math.floor(purchaseAmount * earnRate);
}

export function resolveTier(
  lifetimePoints: number,
  tiers = DEFAULT_LOYALTY_TIERS,
): LoyaltyTierCode {
  const ordered = [...tiers].sort((a, b) => b.minPoints - a.minPoints);
  for (const t of ordered) {
    if (lifetimePoints >= t.minPoints) return t.code;
  }
  return "silver";
}

export function assertRedeemable(
  balance: number,
  points: number,
  offer?: { pointsCost: number; endsAt?: string | null; isActive?: boolean },
  now = new Date(),
): void {
  if (points <= 0) throw new ValidationDomainError("Redeem points must be positive");
  if (balance < points) throw new ValidationDomainError("Insufficient loyalty points");
  if (offer) {
    if (offer.isActive === false) throw new ValidationDomainError("Offer inactive");
    if (offer.pointsCost !== points) {
      throw new ValidationDomainError("Points must match offer cost");
    }
    if (offer.endsAt && new Date(offer.endsAt).getTime() < now.getTime()) {
      throw new ValidationDomainError("Offer expired");
    }
  }
}

export function priceBookForCustomerType(
  customerType: "retail" | "wholesale" | "dealer",
): PriceBook {
  if (customerType === "wholesale") return "wholesale";
  if (customerType === "dealer") return "dealer";
  return "retail";
}

export function pickProductPrice(
  product: {
    retailPrice: number;
    wholesalePrice: number;
    dealerPrice: number;
  },
  book: PriceBook,
): number {
  if (book === "wholesale") return product.wholesalePrice;
  if (book === "dealer") return product.dealerPrice;
  return product.retailPrice;
}

export type CustomerProfile = {
  id: string;
  customerType: "retail" | "wholesale" | "dealer";
  locationCity?: string | null;
  outstanding: number;
  totalPurchases: number;
  loyaltyTier?: LoyaltyTierCode | null;
};

export function customerMatchesSegment(
  customer: CustomerProfile,
  rule: CreateSegmentInput["ruleJson"] | Record<string, unknown>,
): boolean {
  const r = (rule ?? {}) as {
    customerTypes?: string[];
    cities?: string[];
    minOutstanding?: number;
    minTotalPurchases?: number;
    loyaltyTiers?: string[];
  };
  if (r.customerTypes?.length && !r.customerTypes.includes(customer.customerType)) return false;
  if (r.cities?.length) {
    const city = (customer.locationCity ?? "").toLowerCase();
    if (!r.cities.some((c) => c.toLowerCase() === city)) return false;
  }
  if (r.minOutstanding != null && customer.outstanding < r.minOutstanding) return false;
  if (r.minTotalPurchases != null && customer.totalPurchases < r.minTotalPurchases) return false;
  if (r.loyaltyTiers?.length) {
    if (!customer.loyaltyTier || !r.loyaltyTiers.includes(customer.loyaltyTier)) return false;
  }
  return true;
}

export function campaignNeedsSegment(channel: CampaignChannel): boolean {
  return channel !== "customer_specific";
}

export type StockAvailability = {
  productId: string;
  variantId?: string | null;
  qtyOnHand: number;
  qtyReserved: number;
};

export function availableQty(row: StockAvailability): number {
  return Math.max(0, money(row.qtyOnHand - row.qtyReserved));
}

export function assertStoreStock(
  lines: Array<{ productId: string; variantId?: string; qty: number }>,
  stock: StockAvailability[],
): void {
  for (const line of lines) {
    const row = stock.find(
      (s) =>
        s.productId === line.productId &&
        (line.variantId ? s.variantId === line.variantId : true),
    );
    const avail = row ? availableQty(row) : 0;
    if (avail < line.qty) {
      throw new ValidationDomainError(
        `Insufficient stock for product ${line.productId} (need ${line.qty}, available ${avail})`,
      );
    }
  }
}

export function buildOnlineOrderNotes(input: StoreCheckoutInput): string {
  const parts = ["Online store order"];
  if (input.customerName) parts.push(`Customer: ${input.customerName}`);
  if (input.customerMobile) parts.push(`Mobile: ${input.customerMobile}`);
  if (input.notes) parts.push(input.notes);
  return parts.join(" | ");
}

export function buyingPatternSummary(
  sales: Array<{ postedAt: string; grandTotal: number; productIds: string[] }>,
): {
  orderCount: number;
  totalSpend: number;
  avgOrderValue: number;
  topProductIds: string[];
  lastPurchaseAt: string | null;
} {
  const orderCount = sales.length;
  const totalSpend = money(sales.reduce((a, s) => a + s.grandTotal, 0));
  const freq = new Map<string, number>();
  for (const s of sales) {
    for (const p of s.productIds) freq.set(p, (freq.get(p) ?? 0) + 1);
  }
  const topProductIds = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);
  const last = [...sales].sort((a, b) => b.postedAt.localeCompare(a.postedAt))[0];
  return {
    orderCount,
    totalSpend,
    avgOrderValue: orderCount ? money(totalSpend / orderCount) : 0,
    topProductIds,
    lastPurchaseAt: last?.postedAt ?? null,
  };
}
