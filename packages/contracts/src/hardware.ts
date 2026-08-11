import { z } from "zod";
import { UuidSchema } from "./common.js";

export const PrintDocumentTypeSchema = z.enum([
  "sales_invoice",
  "purchase_invoice",
  "payment_receipt",
  "installment_receipt",
  "quotation",
  "delivery_challan",
  "warranty_card",
  "repair_job_card",
  "barcode_label",
  "stock_report",
]);

export const PrintMediaSchema = z.enum(["a4", "receipt_80", "receipt_58", "label", "barcode"]);

export const CreatePrintJobSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema.optional(),
  documentType: PrintDocumentTypeSchema,
  media: PrintMediaSchema.optional(),
  title: z.string().min(1).max(200),
  lines: z.array(z.string()).default([]),
  meta: z.record(z.union([z.string(), z.number(), z.null()])).optional(),
  barcodeValue: z.string().max(128).optional(),
  copies: z.number().int().min(1).max(100).default(1),
});
export type CreatePrintJobInput = z.input<typeof CreatePrintJobSchema>;

export const OpenCashDrawerSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema.optional(),
  reason: z.string().max(200).optional(),
});
export type OpenCashDrawerInput = z.input<typeof OpenCashDrawerSchema>;

export const HardwareEventSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema.optional(),
  capability: z.string().min(1).max(64),
  status: z.string().min(1).max(64),
  message: z.string().max(500).optional(),
  payload: z.record(z.unknown()).optional(),
});
