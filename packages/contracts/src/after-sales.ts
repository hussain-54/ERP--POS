import { z } from "zod";
import { MoneySchema, QuantitySchema, UuidSchema } from "./common.js";
import { PositiveDecimalStringSchema } from "./decimal.js";

export const QuotationStatusSchema = z.enum([
  "draft",
  "sent",
  "accepted",
  "converted_to_order",
  "expired",
  "cancelled",
]);
export type QuotationStatus = z.infer<typeof QuotationStatusSchema>;

export const QuoteLineInputSchema = z.object({
  productId: UuidSchema,
  variantId: UuidSchema.optional(),
  unitId: UuidSchema,
  qty: z.union([QuantitySchema, PositiveDecimalStringSchema]),
  unitPrice: MoneySchema,
  discount: MoneySchema.default(0),
  tax: MoneySchema.default(0),
});
export type QuoteLineInput = z.input<typeof QuoteLineInputSchema>;

export const CreateQuotationSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  customerId: UuidSchema.optional(),
  items: z.array(QuoteLineInputSchema).min(1),
  discountTotal: MoneySchema.default(0),
  validityDate: z.string().optional(),
  terms: z.string().max(2000).optional(),
  notes: z.string().max(1000).optional(),
  idempotencyKey: UuidSchema,
});
export type CreateQuotationInput = z.input<typeof CreateQuotationSchema>;

export const SalesOrderStatusSchema = z.enum([
  "draft",
  "confirmed",
  "converted_to_invoice",
  "cancelled",
]);
export type SalesOrderStatus = z.infer<typeof SalesOrderStatusSchema>;

export const CreateSalesOrderSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  warehouseId: UuidSchema.optional(),
  customerId: UuidSchema.optional(),
  quotationId: UuidSchema.optional(),
  items: z.array(QuoteLineInputSchema).min(1),
  discountTotal: MoneySchema.default(0),
  notes: z.string().max(1000).optional(),
  idempotencyKey: UuidSchema,
  channel: z.enum(["erp", "b2b", "online"]).default("erp"),
  approvalStatus: z.enum(["none", "pending", "approved", "rejected"]).default("none"),
  priceBook: z.enum(["retail", "wholesale", "dealer"]).optional(),
});
export type CreateSalesOrderInput = z.input<typeof CreateSalesOrderSchema>;

export const ConvertOrderToInvoiceSchema = z.object({
  organizationId: UuidSchema,
  orderId: UuidSchema,
  warehouseId: UuidSchema,
  paymentMethodId: UuidSchema.optional(),
  paidTotal: MoneySchema.default(0),
  idempotencyKey: UuidSchema,
});
export type ConvertOrderToInvoiceInput = z.input<typeof ConvertOrderToInvoiceSchema>;

export const ServiceJobStatusSchema = z.enum([
  "received",
  "diagnosis",
  "repairing",
  "ready",
  "delivered",
  "cancelled",
]);
export type ServiceJobStatus = z.infer<typeof ServiceJobStatusSchema>;

export const CreateServiceJobSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  warehouseId: UuidSchema.optional(),
  customerId: UuidSchema.optional(),
  productId: UuidSchema.optional(),
  serialNumberId: UuidSchema.optional(),
  serialCode: z.string().max(128).optional(),
  saleId: UuidSchema.optional(),
  saleWarrantyId: UuidSchema.optional(),
  complaint: z.string().min(1).max(1000),
  issueFound: z.string().max(1000).optional(),
  receivedDate: z.string().optional(),
  technicianUserId: UuidSchema.optional(),
  repairCost: MoneySchema.default(0),
  serviceCharges: MoneySchema.default(0),
  notes: z.string().max(1000).optional(),
  idempotencyKey: UuidSchema,
});
export type CreateServiceJobInput = z.input<typeof CreateServiceJobSchema>;

export const AddServicePartSchema = z.object({
  organizationId: UuidSchema,
  serviceJobId: UuidSchema,
  warehouseId: UuidSchema,
  productId: UuidSchema,
  unitId: UuidSchema,
  qty: z.union([QuantitySchema, PositiveDecimalStringSchema]),
  unitCost: MoneySchema.default(0),
});
export type AddServicePartInput = z.input<typeof AddServicePartSchema>;

export const WarrantyClaimTypeSchema = z.enum(["repair", "replacement"]);
export const WarrantyClaimStatusSchema = z.enum([
  "open",
  "approved",
  "in_progress",
  "resolved",
  "rejected",
  "cancelled",
]);

export const CreateWarrantyClaimSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  saleWarrantyId: UuidSchema,
  claimType: WarrantyClaimTypeSchema,
  description: z.string().min(1).max(1000),
  serviceJobId: UuidSchema.optional(),
});
export type CreateWarrantyClaimInput = z.input<typeof CreateWarrantyClaimSchema>;

export const WarrantyReplacementSchema = z.object({
  organizationId: UuidSchema,
  warrantyClaimId: UuidSchema,
  warehouseId: UuidSchema,
  newProductId: UuidSchema,
  unitId: UuidSchema,
  qty: z.union([QuantitySchema, PositiveDecimalStringSchema]).default(1),
  newSerialNumberId: UuidSchema.optional(),
  notes: z.string().max(500).optional(),
});
export type WarrantyReplacementInput = z.input<typeof WarrantyReplacementSchema>;

export const WarrantyLookupQuerySchema = z.object({
  serialCode: z.string().max(128).optional(),
  saleId: UuidSchema.optional(),
  invoiceNumber: z.string().max(64).optional(),
  productId: UuidSchema.optional(),
});
export type WarrantyLookupQuery = z.input<typeof WarrantyLookupQuerySchema>;
