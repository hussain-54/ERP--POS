import { z } from "zod";
import { AuditedFieldsSchema, PermissionKeySchema, UuidSchema } from "./common.js";

export const UserProfileSchema = AuditedFieldsSchema.extend({
  id: UuidSchema,
  authUserId: UuidSchema,
  organizationId: UuidSchema,
  email: z.string().email(),
  fullName: z.string().min(1).max(200),
  phone: z.string().max(50).nullable().optional(),
  isActive: z.boolean().default(true),
  defaultBranchId: UuidSchema.nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const RoleSchema = AuditedFieldsSchema.extend({
  id: UuidSchema,
  organizationId: UuidSchema,
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  isSystem: z.boolean().default(false),
});

export type Role = z.infer<typeof RoleSchema>;

export const PermissionSchema = z.object({
  id: UuidSchema,
  key: PermissionKeySchema,
  module: z.string().min(1).max(64),
  action: z.string().min(1).max(64),
  description: z.string().max(500).nullable().optional(),
});

export type Permission = z.infer<typeof PermissionSchema>;

export const UserRoleSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  userId: UuidSchema,
  roleId: UuidSchema,
  branchId: UuidSchema.nullable().optional(),
});

export type UserRole = z.infer<typeof UserRoleSchema>;

export const RolePermissionSchema = z.object({
  id: UuidSchema,
  roleId: UuidSchema,
  permissionId: UuidSchema,
});

export type RolePermission = z.infer<typeof RolePermissionSchema>;

export const AuthSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  expiresAt: z.number().int().positive().optional(),
  user: UserProfileSchema,
  permissions: z.array(PermissionKeySchema).default([]),
  branches: z.array(UuidSchema).default([]),
});

export type AuthSession = z.infer<typeof AuthSessionSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

export type PasswordResetRequestInput = z.infer<typeof PasswordResetRequestSchema>;

export const PasswordResetConfirmSchema = z.object({
  accessToken: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export type PasswordResetConfirmInput = z.infer<typeof PasswordResetConfirmSchema>;
