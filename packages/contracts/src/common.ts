import { z } from "zod";

export const UuidSchema = z.string().uuid("Invalid UUID");
export type Uuid = z.infer<typeof UuidSchema>;

export const IsoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: "Invalid ISO datetime" });

export const MoneySchema = z
  .number({ invalid_type_error: "Amount must be a number" })
  .finite("Amount must be finite")
  .multipleOf(0.01, "Amount must have at most 2 decimal places")
  .min(0, "Amount cannot be negative");

export const SignedMoneySchema = z
  .number({ invalid_type_error: "Amount must be a number" })
  .finite("Amount must be finite")
  .multipleOf(0.01, "Amount must have at most 2 decimal places");

export const QuantitySchema = z
  .number({ invalid_type_error: "Quantity must be a number" })
  .finite("Quantity must be finite")
  .gt(0, "Quantity must be greater than zero")
  .multipleOf(0.0001, "Quantity precision too high");

export const NonNegativeQuantitySchema = z
  .number({ invalid_type_error: "Quantity must be a number" })
  .finite()
  .min(0)
  .multipleOf(0.0001);

export const VersionSchema = z.number().int().positive();

export const AuditedFieldsSchema = z.object({
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  createdBy: UuidSchema.nullable().optional(),
  updatedBy: UuidSchema.nullable().optional(),
  deletedAt: IsoDateTimeSchema.nullable().optional(),
  version: VersionSchema.default(1),
});

export type AuditedFields = z.infer<typeof AuditedFieldsSchema>;

export const OrgScopedSchema = z.object({
  organizationId: UuidSchema,
});

export const BranchScopedSchema = OrgScopedSchema.extend({
  branchId: UuidSchema,
});

export const PermissionKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/, "Permission must be module.action");

export type PermissionKey = z.infer<typeof PermissionKeySchema>;
