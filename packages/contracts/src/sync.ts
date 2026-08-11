import { z } from "zod";
import { IsoDateTimeSchema, UuidSchema } from "./common.js";

export const DevicePlatformSchema = z.enum(["electron", "web", "mobile"]);
export const DeviceStatusSchema = z.enum(["pending", "active", "revoked"]);

export const DeviceSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  branchId: UuidSchema,
  deviceKey: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
  platform: DevicePlatformSchema,
  status: DeviceStatusSchema,
  lastSeenAt: IsoDateTimeSchema.nullable().optional(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export type Device = z.infer<typeof DeviceSchema>;

export const RegisterDeviceSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema,
  deviceKey: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
  platform: DevicePlatformSchema,
});

export type RegisterDeviceInput = z.infer<typeof RegisterDeviceSchema>;

export const SyncQueueStatusSchema = z.enum([
  "pending",
  "processing",
  "done",
  "failed",
]);

export const SyncMetadataSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  deviceId: UuidSchema,
  tableName: z.string().min(1).max(120),
  lastPulledAt: IsoDateTimeSchema.nullable().optional(),
  lastPushedAt: IsoDateTimeSchema.nullable().optional(),
  serverCursor: z.string().nullable().optional(),
  clientCursor: z.string().nullable().optional(),
});

export type SyncMetadata = z.infer<typeof SyncMetadataSchema>;

export const SyncQueueItemSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  deviceId: UuidSchema,
  direction: z.enum(["push", "pull"]),
  entityType: z.string().min(1).max(64),
  entityId: UuidSchema,
  payload: z.record(z.unknown()),
  idempotencyKey: z.string().uuid(),
  status: SyncQueueStatusSchema,
  attempts: z.number().int().min(0).default(0),
  lastError: z.string().nullable().optional(),
});

export type SyncQueueItem = z.infer<typeof SyncQueueItemSchema>;

export const SyncConflictSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  deviceId: UuidSchema,
  entityType: z.string().min(1).max(64),
  entityId: UuidSchema,
  serverVersion: z.number().int().positive(),
  clientVersion: z.number().int().positive(),
  serverPayload: z.record(z.unknown()),
  clientPayload: z.record(z.unknown()),
  resolution: z.enum([
    "pending",
    "server_wins",
    "client_wins",
    "merged",
    "manual",
  ]),
});

export type SyncConflict = z.infer<typeof SyncConflictSchema>;

export const SyncPushRequestSchema = z.object({
  deviceId: UuidSchema,
  items: z
    .array(
      z.object({
        entityType: z.string().min(1).max(64),
        entityId: UuidSchema,
        idempotencyKey: z.string().uuid(),
        payload: z.record(z.unknown()),
      }),
    )
    .min(1)
    .max(100),
});

export type SyncPushRequest = z.infer<typeof SyncPushRequestSchema>;

export const SyncPullRequestSchema = z.object({
  deviceId: UuidSchema,
  tableName: z.string().min(1).max(120),
  cursor: z.string().nullable().optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

export type SyncPullRequest = z.infer<typeof SyncPullRequestSchema>;

export const ResolveSyncConflictSchema = z.object({
  organizationId: UuidSchema,
  resolution: z.enum([
    "server_wins",
    "client_wins",
    "latest_version",
    "merged",
    "manual",
    "transaction_reconcile",
  ]),
  remarks: z.string().max(1000).optional(),
});
export type ResolveSyncConflictInput = z.input<typeof ResolveSyncConflictSchema>;

export const SyncStatusResponseSchema = z.object({
  deviceId: UuidSchema.nullable(),
  pendingAcks: z.number().int().nonnegative(),
  openConflicts: z.number().int().nonnegative(),
  lastPushAt: z.string().nullable().optional(),
  lastPullAt: z.string().nullable().optional(),
});
