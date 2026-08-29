import { z } from "zod";
import { UuidSchema } from "./common.js";

export const SystemRoleCodeSchema = z.enum([
  "super_admin",
  "owner",
  "admin",
  "manager",
  "cashier",
  "salesman",
  "storekeeper",
  "warehouse_manager",
  "accountant",
  "delivery_boy",
  "technician",
  "marketing_manager",
]);

export const AssignUserRoleSchema = z.object({
  organizationId: UuidSchema,
  userId: UuidSchema,
  roleId: UuidSchema.optional(),
  roleCode: SystemRoleCodeSchema.optional(),
  branchId: UuidSchema.optional(),
});
export type AssignUserRoleInput = z.input<typeof AssignUserRoleSchema>;

export const CreateUserAdminSchema = z.object({
  organizationId: UuidSchema,
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  fullName: z.string().trim().min(1, "Full name is required").max(200),
  phone: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().trim().max(50).nullable().optional(),
    ),
  roleCode: SystemRoleCodeSchema.optional(),
  branchId: UuidSchema.optional(),
  isActive: z.boolean().default(true),
});
export type CreateUserAdminInput = z.input<typeof CreateUserAdminSchema>;

export const UpdateUserAdminSchema = z.object({
  organizationId: UuidSchema,
  userId: UuidSchema,
  fullName: z.string().trim().min(1, "Full name is required").max(200).optional(),
  phone: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().trim().max(50).nullable().optional(),
    ),
  isActive: z.boolean().optional(),
  defaultBranchId: UuidSchema.nullable().optional(),
});
export type UpdateUserAdminInput = z.input<typeof UpdateUserAdminSchema>;

export const AdminResetPasswordSchema = z.object({
  organizationId: UuidSchema,
  userId: UuidSchema,
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
});
export type AdminResetPasswordInput = z.input<typeof AdminResetPasswordSchema>;

export const SetRolePermissionsSchema = z.object({
  organizationId: UuidSchema,
  roleId: UuidSchema,
  permissionKeys: z.array(z.string()).min(0),
});
export type SetRolePermissionsInput = z.input<typeof SetRolePermissionsSchema>;

export const SetUserPermissionSchema = z.object({
  organizationId: UuidSchema,
  userId: UuidSchema,
  permissionKey: z.string().min(3),
  effect: z.enum(["grant", "deny"]),
  branchId: UuidSchema.optional(),
});
export type SetUserPermissionInput = z.input<typeof SetUserPermissionSchema>;

export const CreateBranchAdminSchema = z.object({
  organizationId: UuidSchema,
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  isMain: z.boolean().default(false),
  address: z.string().max(500).optional(),
});
export type CreateBranchAdminInput = z.input<typeof CreateBranchAdminSchema>;

export const SetBranchMembershipSchema = z.object({
  organizationId: UuidSchema,
  userId: UuidSchema,
  branchId: UuidSchema,
  assign: z.boolean().default(true),
});
export type SetBranchMembershipInput = z.input<typeof SetBranchMembershipSchema>;

export const ApprovalWorkflowTypeSchema = z.enum([
  "discount",
  "purchase",
  "expense",
  "return",
  "credit",
]);

export const CreateApprovalRequestSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema.optional(),
  workflowType: ApprovalWorkflowTypeSchema,
  entityType: z.string().min(1).max(64),
  entityId: UuidSchema.optional(),
  title: z.string().min(1).max(300),
  payload: z.record(z.unknown()).default({}),
  amount: z.number().optional(),
  remarks: z.string().max(1000).optional(),
  requesterRole: z.string().max(64).optional(),
});
export type CreateApprovalRequestInput = z.input<typeof CreateApprovalRequestSchema>;

export const DecideApprovalSchema = z.object({
  organizationId: UuidSchema,
  decision: z.enum(["approve", "reject", "cancel"]),
  remarks: z.string().max(1000).optional(),
  actorRoles: z.array(z.string()).min(1),
});
export type DecideApprovalInput = z.input<typeof DecideApprovalSchema>;

export const CreateAuditLogAdminSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema.optional(),
  actorUserId: UuidSchema.optional(),
  actorRole: z.string().optional(),
  actorKind: z
    .enum([
      "creator",
      "editor",
      "deleter",
      "approver",
      "canceller",
      "discount_giver",
      "payment_receiver",
      "stock_adjuster",
      "other",
    ])
    .optional(),
  action: z.string().min(1).max(120),
  entityType: z.string().min(1).max(64),
  entityId: UuidSchema.optional(),
  before: z.record(z.unknown()).optional(),
  after: z.record(z.unknown()).optional(),
  ipAddress: z.string().max(64).optional(),
  deviceId: UuidSchema.optional(),
  remarks: z.string().max(1000).optional(),
});
export type CreateAuditLogAdminInput = z.input<typeof CreateAuditLogAdminSchema>;
