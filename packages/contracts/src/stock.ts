import { z } from "zod";
import { AuditedFieldsSchema, UuidSchema } from "./common.js";
import { DecimalStringSchema, PositiveDecimalStringSchema } from "./decimal.js";

export const ALL_STOCK_MOVEMENT_TYPES = [
  "opening",
  "purchase",
  "sale",
  "sale_return",
  "purchase_return",
  "damage",
  "adjustment",
  "transfer_out",
  "transfer_in",
  "stock_count",
  "reservation",
  "release_reservation",
  "warranty_replacement",
  "repair_consumption",
] as const;

export const StockMovementTypeSchema = z.enum(ALL_STOCK_MOVEMENT_TYPES);
export type StockMovementType = z.infer<typeof StockMovementTypeSchema>;

export const CostingMethodSchema = z.enum([
  "moving_average",
  "fifo",
  "lifo",
  "specific",
  "standard",
]);
export type CostingMethod = z.infer<typeof CostingMethodSchema>;

export const ReservationSourceTypeSchema = z.enum([
  "sale",
  "order",
  "quotation",
  "delivery",
  "b2b_order",
]);
export type ReservationSourceType = z.infer<typeof ReservationSourceTypeSchema>;

export const SyncStateSchema = z.enum(["pending", "synced", "conflict", "rejected"]);

export const StockBalanceSchema = AuditedFieldsSchema.pick({
  createdAt: true,
  updatedAt: true,
  version: true,
}).extend({
  id: UuidSchema,
  organizationId: UuidSchema,
  branchId: UuidSchema,
  warehouseId: UuidSchema,
  productId: UuidSchema,
  variantId: UuidSchema.nullable().optional(),
  qtyOnHand: DecimalStringSchema,
  qtyReserved: DecimalStringSchema,
  qtyDamaged: DecimalStringSchema,
  qtyInTransit: DecimalStringSchema,
  qtyAvailable: DecimalStringSchema,
  qtyTotal: DecimalStringSchema,
  reorderLevel: DecimalStringSchema,
  overstockLevel: DecimalStringSchema.nullable().optional(),
  isLowStock: z.boolean(),
  isOutOfStock: z.boolean(),
  isOverstock: z.boolean(),
  averageUnitCost: DecimalStringSchema,
  lastMovementAt: z.string().datetime({ offset: true }).nullable().optional(),
});
export type StockBalance = z.infer<typeof StockBalanceSchema>;

/** @deprecated use StockBalance — kept for transitional imports */
export const StockSchema = StockBalanceSchema;
export type Stock = StockBalance;

export const StockMovementSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  branchId: UuidSchema,
  warehouseId: UuidSchema,
  productId: UuidSchema,
  variantId: UuidSchema.nullable().optional(),
  batchId: UuidSchema.nullable().optional(),
  serialNumberId: UuidSchema.nullable().optional(),
  unitId: UuidSchema,
  movementType: StockMovementTypeSchema,
  qtyDelta: z.string().regex(/^-?\d+(\.\d{1,6})?$/),
  qtyBefore: DecimalStringSchema,
  qtyAfter: DecimalStringSchema,
  unitCost: DecimalStringSchema.nullable().optional(),
  sourceType: z.string().min(1).max(64),
  sourceId: UuidSchema,
  reason: z.string().max(500).nullable().optional(),
  occurredAt: z.string().datetime({ offset: true }),
  deviceId: z.string().max(128).nullable().optional(),
  offlineTransactionId: UuidSchema.nullable().optional(),
  operationId: UuidSchema.nullable().optional(),
  syncState: SyncStateSchema.default("synced"),
  createdBy: UuidSchema.nullable().optional(),
  createdAt: z.string().datetime({ offset: true }),
  version: z.number().int().positive(),
});
export type StockMovement = z.infer<typeof StockMovementSchema>;

export const PostStockMovementSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  warehouseId: UuidSchema,
  productId: UuidSchema,
  variantId: UuidSchema.optional(),
  batchId: UuidSchema.optional(),
  serialNumberId: UuidSchema.optional(),
  unitId: UuidSchema,
  movementType: StockMovementTypeSchema,
  qtyDelta: z.string().regex(/^-?\d+(\.\d{1,6})?$/).refine((v) => Number(v) !== 0, "qtyDelta cannot be zero"),
  unitCost: DecimalStringSchema.optional(),
  sourceType: z.string().min(1).max(64),
  sourceId: UuidSchema,
  reason: z.string().max(500).optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  operationId: UuidSchema,
  deviceId: z.string().max(128).optional(),
  offlineTransactionId: UuidSchema.optional(),
  expectedBalanceVersion: z.number().int().positive().optional(),
  allowNegative: z.boolean().optional(),
});
export type PostStockMovementInput = z.input<typeof PostStockMovementSchema>;

export const CreateStockAdjustmentSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  warehouseId: UuidSchema,
  productId: UuidSchema,
  variantId: UuidSchema.optional(),
  unitId: UuidSchema,
  qtyAfter: DecimalStringSchema,
  reason: z.string().min(1).max(500),
  idempotencyKey: UuidSchema,
  requiresApproval: z.boolean().default(true),
});
export type CreateStockAdjustmentInput = z.input<typeof CreateStockAdjustmentSchema>;

export const CreateBatchSchema = z.object({
  organizationId: UuidSchema,
  productId: UuidSchema,
  variantId: UuidSchema.optional(),
  batchNumber: z.string().min(1).max(64),
  manufacturingDate: z.string().optional(),
  expiryDate: z.string().optional(),
  warrantyStart: z.string().optional(),
  warrantyEnd: z.string().optional(),
});
export type CreateBatchInput = z.input<typeof CreateBatchSchema>;

export const CreateSerialSchema = z.object({
  organizationId: UuidSchema,
  productId: UuidSchema,
  variantId: UuidSchema.optional(),
  batchId: UuidSchema.optional(),
  serialNumber: z.string().min(1).max(128),
  warehouseId: UuidSchema.optional(),
  manufacturingDate: z.string().optional(),
  expiryDate: z.string().optional(),
  warrantyStart: z.string().optional(),
  warrantyEnd: z.string().optional(),
});
export type CreateSerialInput = z.input<typeof CreateSerialSchema>;

export const CreateReservationSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  warehouseId: UuidSchema,
  productId: UuidSchema,
  variantId: UuidSchema.optional(),
  batchId: UuidSchema.optional(),
  serialId: UuidSchema.optional(),
  unitId: UuidSchema,
  qty: PositiveDecimalStringSchema,
  sourceType: ReservationSourceTypeSchema,
  sourceId: UuidSchema,
  expiresAt: z.string().datetime({ offset: true }).optional(),
  operationId: UuidSchema,
});
export type CreateReservationInput = z.input<typeof CreateReservationSchema>;

export const CreateStockCountSessionSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  warehouseId: UuidSchema,
  code: z.string().min(1).max(64),
  notes: z.string().max(1000).optional(),
});
export type CreateStockCountSessionInput = z.input<typeof CreateStockCountSessionSchema>;

export const UpsertStockCountLineSchema = z.object({
  organizationId: UuidSchema,
  sessionId: UuidSchema,
  productId: UuidSchema,
  variantId: UuidSchema.optional(),
  batchId: UuidSchema.optional(),
  serialNumber: z.string().max(128).optional(),
  barcodeScanned: z.string().max(128).optional(),
  expectedQty: DecimalStringSchema,
  countedQty: DecimalStringSchema,
  unitId: UuidSchema,
});
export type UpsertStockCountLineInput = z.input<typeof UpsertStockCountLineSchema>;

export const AvailableQtySchema = z.object({
  onHand: DecimalStringSchema,
  reserved: DecimalStringSchema,
  available: DecimalStringSchema,
  damaged: DecimalStringSchema,
  inTransit: DecimalStringSchema,
  total: DecimalStringSchema,
});

export const OfflineStockMutationSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  deviceId: z.string().min(1).max(128),
  offlineTransactionId: UuidSchema,
  operationId: UuidSchema,
  entityId: UuidSchema,
  entityType: z.literal("stock_movement"),
  payload: z.record(z.unknown()),
  timestamp: z.string().datetime({ offset: true }),
  version: z.number().int().positive(),
  syncState: SyncStateSchema,
});
export type OfflineStockMutation = z.infer<typeof OfflineStockMutationSchema>;

export function assertSufficientStock(available: string | number, required: string | number): void {
  const a = typeof available === "number" ? available : Number(available);
  const r = typeof required === "number" ? required : Number(required);
  if (a + 1e-9 < r) {
    throw new Error("Insufficient stock");
  }
}
