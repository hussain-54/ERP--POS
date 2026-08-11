import { z } from "zod";
import { AuditedFieldsSchema, MoneySchema, QuantitySchema, UuidSchema } from "./common.js";
import { DecimalStringSchema, PositiveDecimalStringSchema } from "./decimal.js";

export const SaleStatusSchema = z.enum([
  "draft",
  "held",
  "posted",
  "void",
  "returned",
  "exchanged",
]);
export type SaleStatus = z.infer<typeof SaleStatusSchema>;

export const PaymentStatusSchema = z.enum(["unpaid", "partial", "paid", "refunded"]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const PosModeSchema = z.enum(["easy", "advanced"]);
export const PosLocaleModeSchema = z.enum(["en", "ur", "en_ur"]);

export const DiscountKindSchema = z.enum([
  "percentage",
  "fixed",
  "customer",
  "wholesale",
  "promotion",
  "special",
]);
export const DiscountScopeSchema = z.enum(["item", "invoice"]);
export const ApproverRoleSchema = z.enum(["cashier", "manager", "owner"]);
export type ApproverRole = z.infer<typeof ApproverRoleSchema>;
export type DiscountKind = z.infer<typeof DiscountKindSchema>;

export const SaleItemInputSchema = z.object({
  productId: UuidSchema.optional(),
  variantId: UuidSchema.optional(),
  unitId: UuidSchema,
  qty: z.union([QuantitySchema, PositiveDecimalStringSchema]),
  unitPrice: MoneySchema,
  discount: MoneySchema.default(0),
  discountPercent: z.number().min(0).max(100).default(0),
  tax: MoneySchema.default(0),
  batchId: UuidSchema.optional(),
  serialNumberId: UuidSchema.optional(),
  warrantyDays: z.number().int().min(0).default(0),
  costPrice: MoneySchema.default(0),
  isManual: z.boolean().default(false),
  manualName: z.string().max(200).optional(),
  manualItemCode: z.string().max(64).optional(),
  manualDescription: z.string().max(500).optional(),
  discountKind: DiscountKindSchema.optional(),
});
export type SaleItemInput = z.input<typeof SaleItemInputSchema>;

export const SalePaymentInputSchema = z.object({
  paymentMethodId: UuidSchema,
  amount: z.union([MoneySchema, PositiveDecimalStringSchema]),
  paymentAccountId: UuidSchema.optional(),
  reference: z.string().max(120).optional(),
});
export type SalePaymentInput = z.input<typeof SalePaymentInputSchema>;

export const SaleDiscountAuditInputSchema = z.object({
  scope: DiscountScopeSchema,
  kind: DiscountKindSchema,
  percent: z.number().min(0).max(100).optional(),
  amount: MoneySchema,
  approverRole: ApproverRoleSchema,
  reason: z.string().max(500).optional(),
  saleItemIndex: z.number().int().min(0).optional(),
});

export const CreateSaleBaseSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  warehouseId: UuidSchema,
  customerId: UuidSchema.optional(),
  salesmanUserId: UuidSchema.optional(),
  referenceName: z.string().max(200).optional(),
  priceLevelId: UuidSchema.optional(),
  posMode: PosModeSchema.default("advanced"),
  localeMode: PosLocaleModeSchema.default("en"),
  items: z.array(SaleItemInputSchema).min(1, "At least one line item required"),
  payments: z.array(SalePaymentInputSchema).default([]),
  discountTotal: MoneySchema.default(0),
  invoiceDiscountKind: DiscountKindSchema.optional(),
  discounts: z.array(SaleDiscountAuditInputSchema).default([]),
  idempotencyKey: UuidSchema,
  notes: z.string().max(1000).optional(),
  warrantyNotes: z.string().max(1000).optional(),
  dueDate: z.string().optional(),
  creditApprovalId: UuidSchema.optional(),
  createInstallment: z
    .object({
      downPayment: DecimalStringSchema,
      installmentCount: z.number().int().positive(),
      startDate: z.string(),
    })
    .optional(),
  deviceId: z.string().max(128).optional(),
  offlineTransactionId: UuidSchema.optional(),
  operationId: UuidSchema.optional(),
  commissionPercent: z.number().min(0).max(100).default(0),
});

export const CreateSaleSchema = CreateSaleBaseSchema.superRefine((value, ctx) => {
  for (const [i, item] of value.items.entries()) {
    if (item.isManual) {
      if (!item.manualName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Manual item requires name",
          path: ["items", i, "manualName"],
        });
      }
    } else if (!item.productId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "productId required for catalog items",
        path: ["items", i, "productId"],
      });
    }
  }
});
export type CreateSaleInput = z.input<typeof CreateSaleSchema>;

export const HoldSaleSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  saleId: UuidSchema.optional(),
  holdLabel: z.string().max(120).optional(),
  cartSnapshot: z.record(z.unknown()),
  deviceId: z.string().max(128).optional(),
  draft: CreateSaleBaseSchema.partial().optional(),
});
export type HoldSaleInput = z.input<typeof HoldSaleSchema>;

export const CreateSaleReturnSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  warehouseId: UuidSchema,
  originalSaleId: UuidSchema,
  returnType: z.enum(["refund", "credit", "exchange"]),
  reason: z.string().min(1).max(500),
  items: z
    .array(
      z.object({
        originalSaleItemId: UuidSchema.optional(),
        productId: UuidSchema.optional(),
        unitId: UuidSchema,
        qty: z.union([QuantitySchema, PositiveDecimalStringSchema]),
        unitPrice: MoneySchema,
        exchangeProductId: UuidSchema.optional(),
      }),
    )
    .min(1),
  idempotencyKey: UuidSchema,
  deviceId: z.string().max(128).optional(),
  offlineTransactionId: UuidSchema.optional(),
  operationId: UuidSchema.optional(),
});
export type CreateSaleReturnInput = z.input<typeof CreateSaleReturnSchema>;

export const ProductSearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  warehouseId: UuidSchema.optional(),
  customerId: UuidSchema.optional(),
  priceLevelId: UuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ProductSearchQuery = z.input<typeof ProductSearchQuerySchema>;

export const ProductSearchResultSchema = z.object({
  productId: UuidSchema,
  name: z.string(),
  nameUr: z.string().nullable().optional(),
  sku: z.string(),
  barcode: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  watt: z.string().nullable().optional(),
  voltage: z.string().nullable().optional(),
  ampere: z.string().nullable().optional(),
  unitId: UuidSchema,
  unitName: z.string().nullable().optional(),
  stockAvailable: DecimalStringSchema,
  retailPrice: MoneySchema,
  wholesalePrice: MoneySchema,
  dealerPrice: MoneySchema,
  warrantyDays: z.number().int(),
});
export type ProductSearchResult = z.infer<typeof ProductSearchResultSchema>;

export const SaleSchema = AuditedFieldsSchema.extend({
  id: UuidSchema,
  organizationId: UuidSchema,
  branchId: UuidSchema,
  warehouseId: UuidSchema,
  invoiceNumber: z.string().min(1).max(64),
  status: SaleStatusSchema,
  posMode: PosModeSchema,
  localeMode: PosLocaleModeSchema,
  customerId: UuidSchema.nullable().optional(),
  salesmanUserId: UuidSchema.nullable().optional(),
  referenceName: z.string().nullable().optional(),
  subtotal: MoneySchema,
  discountTotal: MoneySchema,
  taxTotal: MoneySchema,
  grandTotal: MoneySchema,
  paidTotal: MoneySchema,
  remainingTotal: MoneySchema,
  paymentStatus: PaymentStatusSchema,
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  postedAt: z.string().datetime({ offset: true }).nullable().optional(),
  idempotencyKey: UuidSchema,
  deviceId: z.string().nullable().optional(),
  offlineTransactionId: UuidSchema.nullable().optional(),
  syncState: z.enum(["pending", "synced", "conflict", "rejected"]).optional(),
});
export type Sale = z.infer<typeof SaleSchema>;

export const InvoiceViewSchema = z.object({
  sale: SaleSchema,
  customerName: z.string().nullable().optional(),
  customerMobile: z.string().nullable().optional(),
  customerAddress: z.string().nullable().optional(),
  items: z.array(
    z.object({
      name: z.string(),
      qty: z.union([z.number(), z.string()]),
      unit: z.string().optional(),
      rate: MoneySchema,
      discount: MoneySchema,
      tax: MoneySchema,
      total: MoneySchema,
      warrantyDays: z.number().int().optional(),
    }),
  ),
  payments: z.array(
    z.object({
      method: z.string(),
      amount: MoneySchema,
    }),
  ),
  logoUrl: z.string().nullable().optional(),
});
export type InvoiceView = z.infer<typeof InvoiceViewSchema>;
