import { z } from "zod";
import { AuditedFieldsSchema, UuidSchema } from "./common.js";
import { DecimalStringSchema, PositiveDecimalStringSchema } from "./decimal.js";

export const SYSTEM_PAYMENT_METHOD_KINDS = [
  "cash",
  "bank",
  "card",
  "jazzcash",
  "easypaisa",
  "sadapay",
  "online",
  "credit",
  "installment",
] as const;

export const PaymentMethodKindSchema = z.enum([
  ...SYSTEM_PAYMENT_METHOD_KINDS,
  "other",
]);
export type PaymentMethodKind = z.infer<typeof PaymentMethodKindSchema>;

export const PaymentMethodSchema = AuditedFieldsSchema.pick({
  createdAt: true,
  updatedAt: true,
  version: true,
  deletedAt: true,
}).extend({
  id: UuidSchema,
  organizationId: UuidSchema,
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  kind: PaymentMethodKindSchema,
  isSystem: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const CreatePaymentMethodSchema = z.object({
  organizationId: UuidSchema,
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  kind: PaymentMethodKindSchema,
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export type CreatePaymentMethodInput = z.input<typeof CreatePaymentMethodSchema>;

export const PaymentSplitInputSchema = z.object({
  paymentMethodId: UuidSchema,
  amount: PositiveDecimalStringSchema,
  reference: z.string().max(120).optional(),
});

export const PostSplitPaymentSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  direction: z.enum(["receive", "pay"]),
  partyType: z.enum(["customer", "supplier"]),
  customerId: UuidSchema.optional(),
  supplierId: UuidSchema.optional(),
  splits: z.array(PaymentSplitInputSchema).min(1),
  reference: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
  sourceType: z.string().max(64).optional(),
  sourceId: UuidSchema.optional(),
  idempotencyKey: UuidSchema,
  operationId: UuidSchema.optional(),
  deviceId: z.string().max(128).optional(),
  offlineTransactionId: UuidSchema.optional(),
  /** When credit portion exceeds limit, pass approved creditApprovalId */
  creditApprovalId: UuidSchema.optional(),
  billTotal: PositiveDecimalStringSchema.optional(),
}).superRefine((val, ctx) => {
  // Walk-in POS cash sales may post payments against a sale with no customer ledger party.
  const walkInSale = val.partyType === "customer" && !val.customerId && val.sourceType === "sale";
  if (val.partyType === "customer" && !val.customerId && !walkInSale) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "customerId required", path: ["customerId"] });
  }
  if (val.partyType === "supplier" && !val.supplierId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "supplierId required", path: ["supplierId"] });
  }
});
export type PostSplitPaymentInput = z.input<typeof PostSplitPaymentSchema>;

/** @deprecated — use PostSplitPaymentSchema */
export const ReceiveOnAccountSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  customerId: UuidSchema,
  amount: PositiveDecimalStringSchema,
  paymentMethodId: UuidSchema,
  paymentAccountId: UuidSchema.optional(),
  reference: z.string().max(120).optional(),
  idempotencyKey: UuidSchema,
});
export type ReceiveOnAccountInput = z.input<typeof ReceiveOnAccountSchema>;

export const PaymentSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  branchId: UuidSchema,
  direction: z.enum(["receive", "pay"]),
  partyType: z.enum(["customer", "supplier"]),
  customerId: UuidSchema.nullable().optional(),
  supplierId: UuidSchema.nullable().optional(),
  totalAmount: DecimalStringSchema,
  reference: z.string().nullable().optional(),
  receiptNumber: z.string().nullable().optional(),
  status: z.enum(["draft", "posted", "void"]),
  idempotencyKey: UuidSchema,
  occurredAt: z.string().datetime({ offset: true }),
  createdAt: z.string().datetime({ offset: true }),
  syncState: z.enum(["pending", "synced", "conflict", "rejected"]).optional(),
});
export type Payment = z.infer<typeof PaymentSchema>;

export const OfflinePaymentMutationSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  deviceId: z.string().min(1),
  offlineTransactionId: UuidSchema,
  operationId: UuidSchema,
  entityId: UuidSchema,
  entityType: z.literal("payment"),
  payload: z.record(z.unknown()),
  timestamp: z.string().datetime({ offset: true }),
  version: z.number().int().positive(),
  syncState: z.enum(["pending", "synced", "conflict", "rejected"]),
});
export type OfflinePaymentMutation = z.infer<typeof OfflinePaymentMutationSchema>;
