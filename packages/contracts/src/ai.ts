import { z } from "zod";
import { MoneySchema, UuidSchema } from "./common.js";

export const AI_PERMISSIONS = ["ai.recognize", "ai.insights", "ai.manage"] as const;

export const DEFAULT_RECOGNITION_CONFIDENCE = 0.78;

export const ProductSignalSchema = z.object({
  brand: z.string().max(120).optional(),
  company: z.string().max(120).optional(),
  model: z.string().max(120).optional(),
  variant: z.string().max(120).optional(),
  size: z.string().max(80).optional(),
  color: z.string().max(80).optional(),
  watt: z.number().nonnegative().optional(),
  specifications: z.string().max(500).optional(),
  unit: z.string().max(40).optional(),
  freeText: z.string().max(500).optional(),
});
export type ProductSignalInput = z.infer<typeof ProductSignalSchema>;

export const RecognizeProductSchema = z.object({
  organizationId: UuidSchema,
  warehouseId: UuidSchema.optional(),
  branchId: UuidSchema.optional(),
  imageBase64: z.string().max(8_000_000).optional(),
  imageMimeType: z.string().max(80).optional(),
  signals: ProductSignalSchema.default({}),
  hintText: z.string().max(500).optional(),
  confidenceThreshold: z.number().min(0).max(1).default(DEFAULT_RECOGNITION_CONFIDENCE),
  source: z.enum(["pos", "ai_camera", "catalog", "api"]).default("api"),
});
export type RecognizeProductInput = z.input<typeof RecognizeProductSchema>;

export const ConfirmRecognitionSchema = z
  .object({
    organizationId: UuidSchema,
    recognitionEventId: UuidSchema,
    productId: UuidSchema.optional(),
    action: z.enum(["confirm_match", "manual_select", "manual_search", "new_product"]),
  })
  .superRefine((v, ctx) => {
    if (v.action !== "new_product" && !v.productId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "productId required unless action is new_product",
        path: ["productId"],
      });
    }
  });

export const VelocityDaysSchema = z.object({
  fastDays: z.number().int().positive().default(30),
  slowDays: z.number().int().positive().default(90),
  stagnantDays: z.number().int().positive().default(180),
});

export const AiInsightKindSchema = z.enum([
  "sales_prediction",
  "velocity",
  "demand_forecast",
  "purchase_recommendation",
  "customer_patterns",
  "profit_optimization",
  "all",
]);
export type AiInsightKind = z.infer<typeof AiInsightKindSchema>;

export const AiInsightsQuerySchema = z.object({
  organizationId: UuidSchema,
  kind: AiInsightKindSchema.default("all"),
  branchId: UuidSchema.optional(),
  warehouseId: UuidSchema.optional(),
  lookbackDays: z.number().int().positive().max(730).default(180),
  velocity: VelocityDaysSchema.default({}),
  horizonDays: z.number().int().positive().max(90).default(30),
});
export type AiInsightsQuery = z.input<typeof AiInsightsQuerySchema>;

export const AiSettingsSchema = z.object({
  organizationId: UuidSchema,
  confidenceThreshold: z.number().min(0).max(1).default(DEFAULT_RECOGNITION_CONFIDENCE),
  velocity: VelocityDaysSchema.default({}),
});

export const MoneyTraceSchema = z.object({
  amount: MoneySchema.optional(),
  source: z.string(),
  detail: z.string().optional(),
});
