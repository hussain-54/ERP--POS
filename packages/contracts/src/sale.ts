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
  "bulk",
]);
export const DiscountScopeSchema = z.enum(["item", "invoice"]);
/** Discount approval ladder used by POS policy. */
export const ApproverRoleSchema = z.enum([
  "cashier",
  "supervisor",
  "manager",
  "owner",
  "special",
]);
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
  /** Cash tendered (amount received); change = received - applied when greater. */
  amountReceived: z.union([MoneySchema, PositiveDecimalStringSchema]).optional(),
  /** Optional method kind hint for domain classification (cash/bank/card/…). */
  methodKind: z.string().max(32).optional(),
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
  /** Marks an advance/deposit settlement against a future balance. */
  isAdvancePayment: z.boolean().optional(),
  createInstallment: z
    .object({
      downPayment: DecimalStringSchema,
      installmentCount: z.number().int().positive(),
      startDate: z.string(),
      frequency: z.enum(["weekly", "biweekly", "monthly", "quarterly"]).default("monthly"),
      lateFeePercent: z.number().min(0).max(100).default(0),
      lateFeeFixed: DecimalStringSchema.default("0"),
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
  warehouseId: UuidSchema,
  saleId: UuidSchema.optional(),
  holdLabel: z.string().max(120).optional(),
  holdReason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  customerId: UuidSchema.optional().nullable(),
  cartSnapshot: z.record(z.unknown()),
  deviceId: z.string().max(128).optional(),
  /** Optional override; default is held_at + 24h. */
  expiresAt: z.string().datetime({ offset: true }).optional(),
  draft: CreateSaleBaseSchema.partial().optional(),
});
export type HoldSaleInput = z.input<typeof HoldSaleSchema>;

export const HeldSaleFilterSchema = z.enum([
  "active",
  "expiring",
  "expired",
  "today",
  "mine",
  "all_pending",
]);
export type HeldSaleFilter = z.infer<typeof HeldSaleFilterSchema>;

export const HeldSaleActionSchema = z.enum([
  "resume",
  "resume_and_checkout",
  "edit",
  "duplicate",
  "transfer",
  "cancel",
  "discard",
]);
export type HeldSaleAction = z.infer<typeof HeldSaleActionSchema>;

export const EditHeldSaleSchema = z.object({
  holdLabel: z.string().max(120).optional(),
  holdReason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  customerId: UuidSchema.optional().nullable(),
  cartSnapshot: z.record(z.unknown()).optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});
export type EditHeldSaleInput = z.input<typeof EditHeldSaleSchema>;

export const TransferHeldSaleSchema = z.object({
  toUserId: UuidSchema,
  branchId: UuidSchema.optional(),
});
export type TransferHeldSaleInput = z.input<typeof TransferHeldSaleSchema>;

export const CreateSaleReturnSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  warehouseId: UuidSchema,
  originalSaleId: UuidSchema,
  /** Settlement: refund (cash/bank), credit, or exchange. */
  returnType: z.enum(["refund", "credit", "exchange"]),
  /** full | partial — inferred when omitted. */
  returnScope: z.enum(["full", "partial"]).optional(),
  reasonCode: z
    .enum(["damaged", "wrong_product", "defective", "not_satisfied", "other"])
    .default("other"),
  reason: z.string().max(500).optional(),
  refundMethod: z.enum(["cash", "bank", "customer_credit"]).optional(),
  confirmationNotes: z.string().max(2000).optional(),
  items: z
    .array(
      z.object({
        originalSaleItemId: UuidSchema,
        productId: UuidSchema.optional().nullable(),
        unitId: UuidSchema,
        qty: z.union([QuantitySchema, PositiveDecimalStringSchema]),
        unitPrice: MoneySchema,
        exchangeProductId: UuidSchema.optional().nullable(),
        condition: z
          .enum(["good", "opened", "damaged", "defective", "incomplete"])
          .default("good"),
        originalPackaging: z.boolean().default(true),
        accessoriesComplete: z.boolean().default(true),
        inspectionNotes: z.string().max(1000).optional().nullable(),
        batchId: UuidSchema.optional().nullable(),
      }),
    )
    .min(1),
  idempotencyKey: UuidSchema,
  deviceId: z.string().max(128).optional(),
  offlineTransactionId: UuidSchema.optional(),
  operationId: UuidSchema.optional(),
});
export type CreateSaleReturnInput = z.input<typeof CreateSaleReturnSchema>;

export const SearchReturnInvoicesSchema = z.object({
  branchId: UuidSchema.optional(),
  invoiceNumber: z.string().max(64).optional(),
  customerQuery: z.string().max(120).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type SearchReturnInvoicesInput = z.input<typeof SearchReturnInvoicesSchema>;

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
  /** Decimal places allowed for qty (from units.symbol_places). 0 = integer only. */
  unitSymbolPlaces: z.number().int().min(0).max(4).default(0),
  /** Present when warehouseId was supplied to search; omit when stock is unknown. */
  stockAvailable: DecimalStringSchema.optional(),
  retailPrice: MoneySchema,
  wholesalePrice: MoneySchema,
  dealerPrice: MoneySchema,
  /** Optional customer contract unit price from pricing engine. */
  customerPrice: MoneySchema.optional(),
  /** Optional active promotion unit price. */
  promotionPrice: MoneySchema.optional(),
  /** Optional quantity break prices (sale unit). */
  quantityBreaks: z
    .array(
      z.object({
        minQty: z.number().positive(),
        unitPrice: MoneySchema,
      }),
    )
    .optional(),
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
  invoiceNumber: z.string().optional(),
  dateTime: z.string().optional(),
  branchId: z.string().uuid().optional(),
  branchName: z.string().nullable().optional(),
  terminalId: z.string().nullable().optional(),
  cashierId: z.string().nullable().optional(),
  cashierName: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  customerMobile: z.string().nullable().optional(),
  customerAddress: z.string().nullable().optional(),
  customerEmail: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  salesmanId: z.string().nullable().optional(),
  salesmanName: z.string().nullable().optional(),
  commissionPercent: z.number().nullable().optional(),
  commissionAmount: z.number().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  warrantyNotes: z.string().nullable().optional(),
  paidAmount: MoneySchema.optional(),
  remainingAmount: MoneySchema.optional(),
  items: z.array(
    z.object({
      name: z.string(),
      qty: z.union([z.number(), z.string()]),
      unit: z.string().nullable().optional(),
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
      reference: z.string().nullable().optional(),
    }),
  ),
  logoUrl: z.string().nullable().optional(),
});
export type InvoiceView = z.infer<typeof InvoiceViewSchema>;
