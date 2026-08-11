import { z } from "zod";
import { MoneySchema, UuidSchema } from "./common.js";
import { DecimalStringSchema } from "./decimal.js";

export const ENTERPRISE_PERMISSIONS = [
  "hr.manage",
  "hr.view",
  "hr.payroll",
  "tax.manage",
  "tax.view",
  "tax.export",
  "documents.manage",
  "documents.view",
  "notifications.view",
  "notifications.broadcast",
  "notifications.manage",
] as const;

// ─── HR ───────────────────────────────────────────────────
export const CreateEmployeeSchema = z.object({
  organizationId: UuidSchema,
  code: z.string().min(1).max(64),
  fullName: z.string().min(1).max(200),
  mobile: z.string().max(50).optional(),
  email: z.string().email().max(200).optional(),
  designation: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  branchId: UuidSchema.optional(),
  userId: UuidSchema.optional(),
  isSalesman: z.boolean().default(false),
  baseSalary: DecimalStringSchema.default("0"),
  commissionPercent: z.number().min(0).max(100).default(0),
  joinDate: z.string().optional(),
  isActive: z.boolean().default(true),
});
export type CreateEmployeeInput = z.input<typeof CreateEmployeeSchema>;

export const AttendanceStatusSchema = z.enum(["present", "absent", "leave", "half_day"]);

export const UpsertAttendanceSchema = z.object({
  organizationId: UuidSchema,
  employeeId: UuidSchema,
  workDate: z.string().min(8).max(32),
  status: AttendanceStatusSchema,
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export const CreateSalaryRunSchema = z.object({
  organizationId: UuidSchema,
  periodYm: z.string().regex(/^\d{4}-\d{2}$/),
  employeeId: UuidSchema,
  baseSalary: MoneySchema,
  commissionAmount: MoneySchema.default(0),
  incentiveAmount: MoneySchema.default(0),
  deductions: MoneySchema.default(0),
  notes: z.string().max(500).optional(),
});

export const CreateIncentiveSchema = z.object({
  organizationId: UuidSchema,
  employeeId: UuidSchema,
  title: z.string().min(1).max(200),
  amount: MoneySchema,
  periodYm: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  reason: z.string().max(500).optional(),
});

export const UpsertPerformanceSchema = z.object({
  organizationId: UuidSchema,
  employeeId: UuidSchema,
  periodYm: z.string().regex(/^\d{4}-\d{2}$/),
  score: z.number().min(0).max(100),
  salesAmount: MoneySchema.default(0),
  targetAmount: MoneySchema.default(0),
  notes: z.string().max(1000).optional(),
});

// ─── Tax (architecture-ready; no live FBR claim) ──────────
export const TaxPricingModeSchema = z.enum(["inclusive", "exclusive"]);
export const TaxRateSchema = z.object({
  organizationId: UuidSchema,
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  ratePercent: z.number().min(0).max(100),
  isExempt: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  pricingMode: TaxPricingModeSchema.default("exclusive"),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
});
export type CreateTaxRateInput = z.input<typeof TaxRateSchema>;

export const UpsertTaxProfileSchema = z.object({
  organizationId: UuidSchema,
  ntn: z.string().max(40).optional(),
  strn: z.string().max(40).optional(),
  legalName: z.string().max(200).optional(),
  taxProvince: z.string().max(80).optional(),
  fbrIntegrationEnabled: z.boolean().default(false),
  notes: z.string().max(1000).optional(),
});

export const CreateTaxDocumentSchema = z.object({
  organizationId: UuidSchema,
  documentType: z.enum(["tax_invoice", "credit_note", "debit_note", "export_pack"]),
  sourceType: z.enum(["sale", "purchase", "manual"]),
  sourceId: UuidSchema.optional(),
  taxRateId: UuidSchema.optional(),
  taxableAmount: MoneySchema,
  taxAmount: MoneySchema,
  grandTotal: MoneySchema,
  pricingMode: TaxPricingModeSchema.default("exclusive"),
  buyerNtn: z.string().max(40).optional(),
  buyerStrn: z.string().max(40).optional(),
  notes: z.string().max(1000).optional(),
});

// ─── Documents ────────────────────────────────────────────
export const DocumentEntityTypeSchema = z.enum([
  "customer",
  "supplier",
  "product",
  "sale",
  "purchase",
  "quotation",
  "delivery",
  "repair",
  "warranty",
  "tax",
  "employee",
  "other",
]);

export const DocumentKindSchema = z.enum([
  "cnic",
  "agreement",
  "supplier_document",
  "purchase_bill",
  "warranty_card",
  "tax_document",
  "quotation",
  "delivery_document",
  "repair_document",
  "other",
]);

export const CreateDocumentSchema = z.object({
  organizationId: UuidSchema,
  entityType: DocumentEntityTypeSchema,
  entityId: UuidSchema,
  kind: DocumentKindSchema,
  title: z.string().min(1).max(200),
  fileName: z.string().min(1).max(260),
  mimeType: z.string().max(120).default("application/octet-stream"),
  byteSize: z.number().int().nonnegative().default(0),
  storagePath: z.string().min(1).max(1000),
  checksumSha256: z.string().max(128).optional(),
  isSensitive: z.boolean().default(false),
  notes: z.string().max(1000).optional(),
});
export type CreateDocumentInput = z.input<typeof CreateDocumentSchema>;

// ─── Notifications ────────────────────────────────────────
export const NotificationTypeSchema = z.enum([
  "low_stock",
  "out_of_stock",
  "overstock",
  "installment_due",
  "payment_due",
  "supplier_payment_due",
  "customer_outstanding",
  "stock_received",
  "online_order",
  "quotation",
  "warranty_expiry",
  "repair_ready",
  "approval_request",
  "daily_sales",
  "sync_failure",
  "general",
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationChannelSchema = z.enum(["in_app", "email", "sms", "push"]);

export const CreateNotificationSchema = z.object({
  organizationId: UuidSchema,
  userId: UuidSchema.optional(),
  branchId: UuidSchema.optional(),
  type: NotificationTypeSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  entityType: z.string().max(64).optional(),
  entityId: UuidSchema.optional(),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
  channels: z.array(NotificationChannelSchema).default(["in_app"]),
  metadata: z.record(z.unknown()).default({}),
});
export type CreateNotificationInput = z.input<typeof CreateNotificationSchema>;

export const ScanNotificationsSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema.optional(),
  warehouseId: UuidSchema.optional(),
});
