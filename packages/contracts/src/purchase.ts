import { z } from "zod";
import { AuditedFieldsSchema, MoneySchema, QuantitySchema, UuidSchema } from "./common.js";
import { PositiveDecimalStringSchema } from "./decimal.js";

export const PurchaseStatusSchema = z.enum([
  "draft",
  "posted",
  "partial_return",
  "returned",
  "void",
]);
export type PurchaseStatus = z.infer<typeof PurchaseStatusSchema>;

export const PurchaseItemInputSchema = z.object({
  productId: UuidSchema,
  variantId: UuidSchema.optional(),
  unitId: UuidSchema,
  qty: z.union([QuantitySchema, PositiveDecimalStringSchema]),
  unitCost: MoneySchema,
  discount: MoneySchema.default(0),
  tax: MoneySchema.default(0),
  batchCode: z.string().max(64).optional(),
  expiryDate: z.string().optional(),
  binId: UuidSchema.optional(),
});
export type PurchaseItemInput = z.input<typeof PurchaseItemInputSchema>;

export const CreatePurchaseSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  warehouseId: UuidSchema,
  supplierId: UuidSchema,
  invoiceNumber: z.string().min(1).max(64),
  invoiceDate: z.string().optional(),
  items: z.array(PurchaseItemInputSchema).min(1),
  discountTotal: MoneySchema.default(0),
  paidTotal: MoneySchema.default(0),
  paymentMethodId: UuidSchema.optional(),
  dueDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
  idempotencyKey: UuidSchema,
  deviceId: z.string().max(128).optional(),
  offlineTransactionId: UuidSchema.optional(),
  operationId: UuidSchema.optional(),
});
export type CreatePurchaseInput = z.input<typeof CreatePurchaseSchema>;

export const PurchaseSchema = AuditedFieldsSchema.extend({
  id: UuidSchema,
  organizationId: UuidSchema,
  branchId: UuidSchema,
  warehouseId: UuidSchema,
  supplierId: UuidSchema,
  invoiceNumber: z.string(),
  invoiceDate: z.string(),
  status: PurchaseStatusSchema,
  subtotal: MoneySchema,
  discountTotal: MoneySchema,
  taxTotal: MoneySchema,
  grandTotal: MoneySchema,
  paidTotal: MoneySchema,
  remainingTotal: MoneySchema,
  dueDate: z.string().nullable().optional(),
  idempotencyKey: UuidSchema,
});
export type Purchase = z.infer<typeof PurchaseSchema>;

export const CreatePurchaseReturnSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  warehouseId: UuidSchema,
  originalPurchaseId: UuidSchema,
  reason: z.string().min(1).max(500),
  items: z
    .array(
      z.object({
        originalPurchaseItemId: UuidSchema.optional(),
        productId: UuidSchema,
        unitId: UuidSchema,
        qty: z.union([QuantitySchema, PositiveDecimalStringSchema]),
        unitCost: MoneySchema,
      }),
    )
    .min(1),
  idempotencyKey: UuidSchema,
  deviceId: z.string().max(128).optional(),
  offlineTransactionId: UuidSchema.optional(),
  operationId: UuidSchema.optional(),
});
export type CreatePurchaseReturnInput = z.input<typeof CreatePurchaseReturnSchema>;

export const SupplierProductPriceSchema = z.object({
  supplierId: UuidSchema,
  productId: UuidSchema,
  variantId: UuidSchema.nullable().optional(),
  lastPurchaseRate: MoneySchema,
  averagePurchaseRate: MoneySchema,
  supplierPrice: MoneySchema,
  purchaseCount: z.number().int(),
  lastPurchaseAt: z.string().nullable().optional(),
});
export type SupplierProductPrice = z.infer<typeof SupplierProductPriceSchema>;

export const TransferStatusSchema = z.enum([
  "requested",
  "approved",
  "dispatched",
  "in_transit",
  "received",
  "cancelled",
]);
export type TransferStatus = z.infer<typeof TransferStatusSchema>;

export const CreateStockTransferSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  sourceWarehouseId: UuidSchema,
  destinationWarehouseId: UuidSchema,
  items: z
    .array(
      z.object({
        productId: UuidSchema,
        variantId: UuidSchema.optional(),
        unitId: UuidSchema,
        qty: z.union([QuantitySchema, PositiveDecimalStringSchema]),
      }),
    )
    .min(1),
  notes: z.string().max(1000).optional(),
  idempotencyKey: UuidSchema,
  deviceId: z.string().max(128).optional(),
  offlineTransactionId: UuidSchema.optional(),
  operationId: UuidSchema.optional(),
});
export type CreateStockTransferInput = z.input<typeof CreateStockTransferSchema>;

export const DeliveryStatusSchema = z.enum([
  "pending",
  "packed",
  "dispatched",
  "delivered",
  "cancelled",
  "returned",
]);
export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>;

export const CreateDeliverySchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  warehouseId: UuidSchema.optional(),
  saleId: UuidSchema.optional(),
  customerId: UuidSchema.optional(),
  address: z.string().max(500).optional(),
  mobile: z.string().max(32).optional(),
  deliveryBoyUserId: UuidSchema.optional(),
  expectedDate: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: UuidSchema,
        variantId: UuidSchema.optional(),
        unitId: UuidSchema,
        qty: z.union([QuantitySchema, PositiveDecimalStringSchema]),
      }),
    )
    .min(1),
  notes: z.string().max(1000).optional(),
  idempotencyKey: UuidSchema,
  deviceId: z.string().max(128).optional(),
  offlineTransactionId: UuidSchema.optional(),
  operationId: UuidSchema.optional(),
});
export type CreateDeliveryInput = z.input<typeof CreateDeliverySchema>;

export const CreateRackSchema = z.object({
  organizationId: UuidSchema,
  warehouseId: UuidSchema,
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
});
export const CreateShelfSchema = z.object({
  organizationId: UuidSchema,
  rackId: UuidSchema,
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
});
export const CreateBinSchema = z.object({
  organizationId: UuidSchema,
  shelfId: UuidSchema,
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
});
