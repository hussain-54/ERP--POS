import { z } from "zod";
import { UuidSchema } from "./common.js";

export const INFRASTRUCTURE_PERMISSIONS = [
  "security.manage",
  "security.view",
  "backup.manage",
  "backup.view",
  "backup.restore",
  "integrations.manage",
  "integrations.view",
  "import.execute",
  "export.execute",
] as const;

// ─── Security ─────────────────────────────────────────────
export const PasswordPolicySchema = z.object({
  minLength: z.number().int().min(6).max(128).default(10),
  requireUppercase: z.boolean().default(true),
  requireLowercase: z.boolean().default(true),
  requireNumber: z.boolean().default(true),
  requireSymbol: z.boolean().default(false),
  maxFailedAttempts: z.number().int().min(3).max(50).default(5),
  lockoutMinutes: z.number().int().min(1).max(1440).default(15),
  sessionTtlHours: z.number().int().min(1).max(720).default(24),
  twoFactorOptional: z.boolean().default(true),
  twoFactorEnforced: z.boolean().default(false),
});
export type PasswordPolicy = z.infer<typeof PasswordPolicySchema>;

export const UpsertSecuritySettingsSchema = z.object({
  organizationId: UuidSchema,
  passwordPolicy: PasswordPolicySchema.default({}),
  encryptionStrategy: z
    .enum(["tls_in_transit", "supabase_at_rest", "app_field_encryption_planned"])
    .default("supabase_at_rest"),
  notes: z.string().max(2000).optional(),
});

export const RegisterSecurityDeviceSchema = z.object({
  organizationId: UuidSchema,
  deviceLabel: z.string().min(1).max(200),
  deviceFingerprint: z.string().min(1).max(200),
  platform: z.string().max(80).optional(),
});

export const TwoFactorSetupSchema = z.object({
  organizationId: UuidSchema,
  userId: UuidSchema,
  enabled: z.boolean(),
  method: z.enum(["totp", "email_otp"]).default("totp"),
});

// ─── Backup ───────────────────────────────────────────────
export const BackupTargetSchema = z.enum(["local", "cloud"]);
export const BackupModeSchema = z.enum(["full", "incremental", "daily", "automatic"]);

export const CreateBackupJobSchema = z.object({
  organizationId: UuidSchema,
  mode: BackupModeSchema.default("daily"),
  target: BackupTargetSchema.default("local"),
  encrypted: z.boolean().default(true),
  label: z.string().max(200).optional(),
});

export const CreateRestorePointSchema = z.object({
  organizationId: UuidSchema,
  backupJobId: UuidSchema.optional(),
  label: z.string().min(1).max(200),
  notes: z.string().max(1000).optional(),
});

export const RequestRestoreSchema = z.object({
  organizationId: UuidSchema,
  restorePointId: UuidSchema,
  verifyOnly: z.boolean().default(true),
});

// ─── Integrations / versioned API clients ─────────────────
export const IntegrationAudienceSchema = z.enum([
  "mobile",
  "website",
  "payment_gateway",
  "bank",
  "courier",
  "whatsapp",
  "sms",
  "accounting",
  "ecommerce",
  "custom",
]);

export const CreateIntegrationClientSchema = z.object({
  organizationId: UuidSchema,
  name: z.string().min(1).max(120),
  audience: IntegrationAudienceSchema,
  scopes: z.array(z.string().min(1).max(80)).default(["read"]),
  webhookUrl: z.string().url().optional(),
});

// ─── Import / Export ──────────────────────────────────────
export const ImportEntitySchema = z.enum([
  "products",
  "customers",
  "suppliers",
  "stock",
  "prices",
]);
export type ImportEntity = z.infer<typeof ImportEntitySchema>;

export const ExportFormatSchema = z.enum(["csv", "excel", "pdf"]);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

export const BulkPriceUpdateSchema = z.object({
  organizationId: UuidSchema,
  rows: z
    .array(
      z.object({
        sku: z.string().min(1),
        retailPrice: z.number().nonnegative().optional(),
        wholesalePrice: z.number().nonnegative().optional(),
        dealerPrice: z.number().nonnegative().optional(),
        minimumSalePrice: z.number().nonnegative().optional(),
      }),
    )
    .min(1)
    .max(5000),
  reason: z.string().max(500).optional(),
});
