import { z } from "zod";
import { IsoDateTimeSchema, UuidSchema } from "./common.js";

export const AuditLogSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  branchId: UuidSchema.nullable().optional(),
  actorUserId: UuidSchema.nullable().optional(),
  action: z.string().min(1).max(120),
  entityType: z.string().min(1).max(64),
  entityId: UuidSchema.nullable().optional(),
  before: z.record(z.unknown()).nullable().optional(),
  after: z.record(z.unknown()).nullable().optional(),
  ipAddress: z.string().max(64).nullable().optional(),
  deviceId: UuidSchema.nullable().optional(),
  correlationId: z.string().max(120).nullable().optional(),
  createdAt: IsoDateTimeSchema,
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

export const CreateAuditLogSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema.optional(),
  actorUserId: UuidSchema.optional(),
  action: z.string().min(1).max(120),
  entityType: z.string().min(1).max(64),
  entityId: UuidSchema.optional(),
  before: z.record(z.unknown()).optional(),
  after: z.record(z.unknown()).optional(),
  ipAddress: z.string().max(64).optional(),
  deviceId: UuidSchema.optional(),
  correlationId: z.string().max(120).optional(),
});

export type CreateAuditLogInput = z.infer<typeof CreateAuditLogSchema>;
