import { z } from "zod";
import { AuditedFieldsSchema, UuidSchema } from "./common.js";
import { DecimalStringSchema } from "./decimal.js";

export const CustomerTypeSchema = z.enum(["retail", "wholesale", "dealer"]);
export type CustomerType = z.infer<typeof CustomerTypeSchema>;

export const CreateCustomerSchema = z.object({
  organizationId: UuidSchema,
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  nameUr: z.string().max(200).optional(),
  mobile: z.string().max(50).optional(),
  alternateMobile: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  cnic: z.string().max(20).optional(),
  referenceName: z.string().max(200).optional(),
  customerType: CustomerTypeSchema.default("retail"),
  creditLimit: DecimalStringSchema.default("0"),
  creditDays: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export type CreateCustomerInput = z.input<typeof CreateCustomerSchema>;

export const CustomerSchema = AuditedFieldsSchema.extend({
  id: UuidSchema,
  organizationId: UuidSchema,
  code: z.string(),
  name: z.string(),
  nameUr: z.string().nullable().optional(),
  mobile: z.string().nullable().optional(),
  alternateMobile: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  cnic: z.string().nullable().optional(),
  referenceName: z.string().nullable().optional(),
  customerType: CustomerTypeSchema,
  creditLimit: DecimalStringSchema,
  creditDays: z.number().int(),
  totalPurchases: DecimalStringSchema,
  totalPaid: DecimalStringSchema,
  outstanding: DecimalStringSchema,
  isBlocked: z.boolean(),
  isActive: z.boolean(),
});
export type Customer = z.infer<typeof CustomerSchema>;

export const CreateSupplierSchema = z.object({
  organizationId: UuidSchema,
  code: z.string().min(1).max(64),
  companyName: z.string().min(1).max(200),
  contactPerson: z.string().max(200).optional(),
  mobile: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  ntn: z.string().max(50).optional(),
  strn: z.string().max(50).optional(),
  bankName: z.string().max(120).optional(),
  bankAccountTitle: z.string().max(120).optional(),
  bankAccountNumber: z.string().max(64).optional(),
  bankIban: z.string().max(64).optional(),
  isActive: z.boolean().default(true),
});
export type CreateSupplierInput = z.input<typeof CreateSupplierSchema>;

export const SupplierSchema = AuditedFieldsSchema.extend({
  id: UuidSchema,
  organizationId: UuidSchema,
  code: z.string(),
  companyName: z.string(),
  contactPerson: z.string().nullable().optional(),
  mobile: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  ntn: z.string().nullable().optional(),
  strn: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  bankAccountTitle: z.string().nullable().optional(),
  bankAccountNumber: z.string().nullable().optional(),
  bankIban: z.string().nullable().optional(),
  payableBalance: DecimalStringSchema,
  isActive: z.boolean(),
});
export type Supplier = z.infer<typeof SupplierSchema>;

/** @deprecated — use CustomerCreditProfile / credit fields on customer */
export const CustomerCreditSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  customerId: UuidSchema,
  creditLimit: DecimalStringSchema,
  isBlocked: z.boolean().default(false),
  termsDays: z.number().int().min(0).default(0),
});
export type CustomerCredit = z.infer<typeof CustomerCreditSchema>;

export const LedgerEntryTypeSchema = z.enum([
  "sale",
  "payment",
  "return",
  "discount",
  "adjustment",
  "purchase",
  "credit_note",
  "debit_note",
]);
export type LedgerEntryType = z.infer<typeof LedgerEntryTypeSchema>;

export const PartyLedgerEntrySchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  branchId: UuidSchema.nullable().optional(),
  partyType: z.enum(["customer", "supplier"]),
  customerId: UuidSchema.nullable().optional(),
  supplierId: UuidSchema.nullable().optional(),
  entryType: LedgerEntryTypeSchema,
  debit: DecimalStringSchema,
  credit: DecimalStringSchema,
  balanceAfter: DecimalStringSchema,
  sourceType: z.string(),
  sourceId: UuidSchema,
  description: z.string().nullable().optional(),
  occurredAt: z.string().datetime({ offset: true }),
  createdAt: z.string().datetime({ offset: true }),
  createdBy: UuidSchema.nullable().optional(),
  operationId: UuidSchema.nullable().optional(),
});
export type PartyLedgerEntry = z.infer<typeof PartyLedgerEntrySchema>;

export const CreateCreditApprovalSchema = z.object({
  organizationId: UuidSchema,
  customerId: UuidSchema,
  requestedAmount: DecimalStringSchema,
  reason: z.string().max(500).optional(),
  sourceType: z.string().max(64).optional(),
  sourceId: UuidSchema.optional(),
});
export type CreateCreditApprovalInput = z.input<typeof CreateCreditApprovalSchema>;

export const CreateInstallmentPlanSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  customerId: UuidSchema,
  sourceType: z.string().min(1).max(64),
  sourceId: UuidSchema,
  totalAmount: DecimalStringSchema,
  downPayment: DecimalStringSchema.default("0"),
  installmentCount: z.number().int().positive(),
  startDate: z.string().min(8), // YYYY-MM-DD
});
export type CreateInstallmentPlanInput = z.input<typeof CreateInstallmentPlanSchema>;

export const InstallmentScheduleItemSchema = z.object({
  sequenceNo: z.number().int().positive(),
  dueDate: z.string(),
  amount: DecimalStringSchema,
  status: z.enum(["pending", "partial", "paid", "overdue", "waived"]),
  paidAmount: DecimalStringSchema.optional(),
});
export type InstallmentScheduleItem = z.infer<typeof InstallmentScheduleItemSchema>;
