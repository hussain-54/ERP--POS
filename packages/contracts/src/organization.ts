import { z } from "zod";
import { AuditedFieldsSchema, UuidSchema } from "./common.js";

export const OrganizationSchema = AuditedFieldsSchema.extend({
  id: UuidSchema,
  name: z.string().min(1).max(200),
  legalName: z.string().max(200).nullable().optional(),
  ntn: z.string().max(50).nullable().optional(),
  strn: z.string().max(50).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  defaultCurrency: z.string().length(3).default("PKR"),
  timezone: z.string().min(1).default("Asia/Karachi"),
  settings: z.record(z.unknown()).default({}),
});

export type Organization = z.infer<typeof OrganizationSchema>;

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(200),
  legalName: z.string().max(200).optional(),
  ntn: z.string().max(50).optional(),
  strn: z.string().max(50).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
  defaultCurrency: z.string().length(3).default("PKR"),
  timezone: z.string().min(1).default("Asia/Karachi"),
});

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;

export const BranchSchema = AuditedFieldsSchema.extend({
  id: UuidSchema,
  organizationId: UuidSchema,
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  isActive: z.boolean().default(true),
  settings: z.record(z.unknown()).default({}),
});

export type Branch = z.infer<typeof BranchSchema>;

export const CreateBranchSchema = z.object({
  organizationId: UuidSchema,
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  isActive: z.boolean().default(true),
});

export type CreateBranchInput = z.infer<typeof CreateBranchSchema>;

export const WarehouseTypeSchema = z.enum(["main", "branch", "store", "transit"]);

export const WarehouseSchema = AuditedFieldsSchema.extend({
  id: UuidSchema,
  organizationId: UuidSchema,
  branchId: UuidSchema,
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  warehouseType: WarehouseTypeSchema.default("branch"),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type Warehouse = z.infer<typeof WarehouseSchema>;

export const CreateWarehouseSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  isDefault: z.boolean().default(false),
  warehouseType: WarehouseTypeSchema.default("branch"),
  allowNegativeStock: z.boolean().optional(),
});

export type CreateWarehouseInput = z.infer<typeof CreateWarehouseSchema>;
