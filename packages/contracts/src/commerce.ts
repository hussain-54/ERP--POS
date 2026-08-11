import { z } from "zod";
import { MoneySchema, QuantitySchema, UuidSchema } from "./common.js";
import { PositiveDecimalStringSchema } from "./decimal.js";
import { CustomerTypeSchema } from "./party.js";

export const LoyaltyTierCodeSchema = z.enum(["silver", "gold", "platinum"]);
export type LoyaltyTierCode = z.infer<typeof LoyaltyTierCodeSchema>;

export const CampaignChannelSchema = z.enum([
  "sms",
  "whatsapp",
  "festival",
  "discount",
  "new_product",
  "customer_specific",
]);
export type CampaignChannel = z.infer<typeof CampaignChannelSchema>;

export const OrderChannelSchema = z.enum(["erp", "b2b", "online"]);
export type OrderChannel = z.infer<typeof OrderChannelSchema>;

export const PriceBookSchema = z.enum(["retail", "wholesale", "dealer"]);
export type PriceBook = z.infer<typeof PriceBookSchema>;

export const CreateSegmentSchema = z.object({
  organizationId: UuidSchema,
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  ruleJson: z
    .object({
      customerTypes: z.array(CustomerTypeSchema).optional(),
      cities: z.array(z.string()).optional(),
      minOutstanding: z.number().optional(),
      minTotalPurchases: z.number().optional(),
      loyaltyTiers: z.array(LoyaltyTierCodeSchema).optional(),
    })
    .default({}),
});
export type CreateSegmentInput = z.input<typeof CreateSegmentSchema>;

export const AssignSegmentMemberSchema = z.object({
  organizationId: UuidSchema,
  segmentId: UuidSchema,
  customerId: UuidSchema,
});

export const CreateCampaignSchema = z.object({
  organizationId: UuidSchema,
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  channel: CampaignChannelSchema,
  segmentId: UuidSchema.optional(),
  customerId: UuidSchema.optional(),
  messageTemplate: z.string().min(1).max(2000),
  offerPercent: z.number().min(0).max(100).optional(),
  offerAmount: MoneySchema.optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});
export type CreateCampaignInput = z.input<typeof CreateCampaignSchema>;

export const SeedLoyaltyTiersSchema = z.object({
  organizationId: UuidSchema,
});

export const EarnLoyaltyPointsSchema = z.object({
  organizationId: UuidSchema,
  customerId: UuidSchema,
  purchaseAmount: MoneySchema,
  sourceType: z.string().default("sale"),
  sourceId: UuidSchema.optional(),
  notes: z.string().max(500).optional(),
});

export const RedeemLoyaltyPointsSchema = z.object({
  organizationId: UuidSchema,
  customerId: UuidSchema,
  points: z.number().int().positive(),
  offerId: UuidSchema.optional(),
  sourceType: z.string().default("redemption"),
  sourceId: UuidSchema.optional(),
  notes: z.string().max(500).optional(),
});

export const CreateLoyaltyOfferSchema = z.object({
  organizationId: UuidSchema,
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  tierCode: LoyaltyTierCodeSchema.optional(),
  pointsCost: z.number().int().positive(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: MoneySchema.optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export const CreateB2bPortalUserSchema = z.object({
  organizationId: UuidSchema,
  customerId: UuidSchema,
  email: z.string().email(),
  displayName: z.string().max(200).optional(),
  authUserId: UuidSchema.optional(),
});

export const B2bOrderLineSchema = z.object({
  productId: UuidSchema,
  variantId: UuidSchema.optional(),
  unitId: UuidSchema,
  qty: z.union([QuantitySchema, PositiveDecimalStringSchema]),
  unitPrice: MoneySchema.optional(),
});

export const CreateB2bOrderSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  warehouseId: UuidSchema,
  customerId: UuidSchema,
  items: z.array(B2bOrderLineSchema).min(1),
  notes: z.string().max(1000).optional(),
  idempotencyKey: UuidSchema,
  requireApproval: z.boolean().default(true),
});
export type CreateB2bOrderInput = z.input<typeof CreateB2bOrderSchema>;

export const UpsertStoreSettingsSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  warehouseId: UuidSchema,
  storeName: z.string().min(1).max(200).default("Online Store"),
  isPublished: z.boolean().default(false),
  currency: z.string().length(3).default("PKR"),
});

export const StoreCheckoutLineSchema = z.object({
  productId: UuidSchema,
  variantId: UuidSchema.optional(),
  unitId: UuidSchema,
  qty: z.union([QuantitySchema, PositiveDecimalStringSchema]),
});

export const StoreCheckoutSchema = z.object({
  organizationId: UuidSchema,
  customerId: UuidSchema.optional(),
  customerName: z.string().max(200).optional(),
  customerMobile: z.string().max(50).optional(),
  items: z.array(StoreCheckoutLineSchema).min(1),
  notes: z.string().max(1000).optional(),
  idempotencyKey: UuidSchema,
});
export type StoreCheckoutInput = z.input<typeof StoreCheckoutSchema>;

export const COMMERCE_PERMISSIONS = [
  "crm.manage",
  "crm.view",
  "loyalty.manage",
  "loyalty.redeem",
  "loyalty.view",
  "b2b.manage",
  "b2b.order",
  "b2b.approve",
  "store.manage",
  "store.order",
] as const;
