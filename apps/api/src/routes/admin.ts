import { Router } from "express";
import {
  AdminResetPasswordSchema,
  AssignUserRoleSchema,
  CreateApprovalRequestSchema,
  CreateAuditLogAdminSchema,
  CreateBranchAdminSchema,
  CreateUserAdminSchema,
  DecideApprovalSchema,
  SetBranchMembershipSchema,
  SetRolePermissionsSchema,
  SetUserPermissionSchema,
  UpdateUserAdminSchema,
} from "@electronic-erp/contracts";
import { AdminRepository } from "@electronic-erp/db";
import { AuthorizationService, DomainError } from "@electronic-erp/domain";
import { createServiceClient, createUserClient } from "../lib/supabase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

/**
 * Admin router — modules 26 Users, 27 Permissions, 28 Audit, 30 Branches, 25 Approvals, 01 Dashboard (group).
 * Shared on purpose. Mount: /api/v1/admin. Repository: AdminRepository.
 */
export const adminRouter = Router();
adminRouter.use(requireAuth);

function repo(req: AuthedRequest): AdminRepository {
  return new AdminRepository(createUserClient(req.accessToken!));
}
function authz(req: AuthedRequest): AuthorizationService {
  return new AuthorizationService(req.authz!);
}
function orgId(req: AuthedRequest): string {
  return req.authz!.organizationId;
}
function userId(req: AuthedRequest): string | null {
  return req.authz?.userId ?? null;
}

// 26 Users & Role Management
adminRouter.post("/roles/seed", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("roles.manage");
    res.json({ items: await repo(req).seedSystemRoles(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/roles", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("roles.manage");
    res.json({ items: await repo(req).listRoles(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

// 27 Permissions
adminRouter.get("/permissions", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("permissions.manage");
    res.json({ items: await repo(req).listPermissions() });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/roles/:roleId/permissions", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("permissions.manage");
    res.json({ items: await repo(req).listRolePermissions(req.params.roleId!) });
  } catch (err) {
    next(err);
  }
});

adminRouter.put("/roles/:roleId/permissions", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("permissions.manage");
    const input = SetRolePermissionsSchema.parse({
      ...req.body,
      organizationId: orgId(req),
      roleId: req.params.roleId,
    });
    res.json({ items: await repo(req).setRolePermissions(input) });
  } catch (err) {
    next(err);
  }
});

// 26 Users
adminRouter.get("/users", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("users.manage");
    res.json({ items: await repo(req).listUsers(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/users/detailed", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("users.manage");
    res.json({ items: await repo(req).listDetailedUsers(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/users", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("users.manage");
    const input = CreateUserAdminSchema.parse({ ...req.body, organizationId: orgId(req) });
    const serviceClient = createServiceClient();
    if (!serviceClient) {
      throw new DomainError("Service client not configured to create users", "UNAUTHORIZED");
    }

    const { data: authData, error: authErr } = await serviceClient.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName },
    });

    if (authErr || !authData.user) {
      throw new DomainError(authErr?.message ?? "Failed to create user", "BAD_REQUEST");
    }

    const { data: profile, error: profErr } = await serviceClient
      .from("user_profiles")
      .insert({
        auth_user_id: authData.user.id,
        organization_id: input.organizationId,
        email: input.email,
        full_name: input.fullName,
        phone: input.phone ?? null,
        is_active: input.isActive ?? true,
        default_branch_id: input.branchId ?? null,
        created_by: userId(req),
      })
      .select("*")
      .single();

    if (profErr) {
      await serviceClient.auth.admin.deleteUser(authData.user.id).catch(() => null);
      throw new DomainError(profErr.message, "BAD_REQUEST");
    }

    if (input.roleCode) {
      await repo(req).assignUserRole({
        organizationId: input.organizationId,
        userId: String(profile.id),
        roleCode: input.roleCode,
        branchId: input.branchId,
      });
    }

    if (input.branchId) {
      await repo(req).setBranchMembership({
        organizationId: input.organizationId,
        userId: String(profile.id),
        branchId: input.branchId,
        assign: true,
      });
    }

    res.status(201).json({ item: profile });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/users/:userId", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("users.manage");
    const input = UpdateUserAdminSchema.parse({
      ...req.body,
      organizationId: orgId(req),
      userId: req.params.userId,
    });
    const updated = await repo(req).updateUser(input);
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/users/:userId/reset-password", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("users.manage");
    const input = AdminResetPasswordSchema.parse({
      ...req.body,
      organizationId: orgId(req),
      userId: req.params.userId,
    });

    const serviceClient = createServiceClient();
    if (!serviceClient) {
      throw new DomainError("Service client not configured to reset passwords", "UNAUTHORIZED");
    }

    const { data: profile } = await serviceClient
      .from("user_profiles")
      .select("auth_user_id")
      .eq("id", input.userId)
      .eq("organization_id", input.organizationId)
      .single();

    if (!profile?.auth_user_id) {
      throw new DomainError("User not found", "NOT_FOUND");
    }

    const { error: resetErr } = await serviceClient.auth.admin.updateUserById(
      String(profile.auth_user_id),
      { password: input.newPassword },
    );

    if (resetErr) {
      throw new DomainError(resetErr.message, "BAD_REQUEST");
    }

    res.json({ ok: true, message: "Password reset successfully" });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/users/:userId/roles", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("users.manage");
    res.json({ items: await repo(req).listUserRoles(req.params.userId!) });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/users/roles", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("users.manage");
    const input = AssignUserRoleSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).assignUserRole(input));
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/users/roles/:userRoleId", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("users.manage");
    res.json(await repo(req).removeUserRole(req.params.userRoleId!));
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/users/permissions", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("permissions.manage");
    const input = SetUserPermissionSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).setUserPermission(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/users/:userId/permissions", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("permissions.manage");
    res.json({ items: await repo(req).listUserPermissions(req.params.userId!) });
  } catch (err) {
    next(err);
  }
});

// 30 Multi-Branch
adminRouter.get("/branches", async (req: AuthedRequest, res, next) => {
  try {
    if (!authz(req).can("branches.manage") && !authz(req).canViewAllBranches()) {
      authz(req).assert("branches.manage");
    }
    const items = await repo(req).listBranches(orgId(req));
    const filtered = authz(req).canViewAllBranches()
      ? items
      : items.filter((b) => req.authz!.branchIds.includes(String(b.id)));
    res.json({ items: filtered });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/branches", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("branches.manage");
    const input = CreateBranchAdminSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createBranch(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/branches/memberships", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("branches.manage");
    const input = SetBranchMembershipSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.json(await repo(req).setBranchMembership(input));
  } catch (err) {
    next(err);
  }
});

// 01 Dashboard — group KPIs
adminRouter.get("/dashboard/group", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("dashboard.group_view");
    res.json(await repo(req).groupDashboard(orgId(req)));
  } catch (err) {
    next(err);
  }
});

// 25 Approval Workflow
adminRouter.post("/approvals", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("approvals.act");
    const input = CreateApprovalRequestSchema.parse({ ...req.body, organizationId: orgId(req) });
    if (input.branchId) authz(req).assertBranch(input.branchId);
    res.status(201).json(await repo(req).createApprovalRequest(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/approvals", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("approvals.act");
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json({ items: await repo(req).listApprovals(orgId(req), status) });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/approvals/:id/actions", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("approvals.act");
    res.json({ items: await repo(req).listApprovalActions(req.params.id!) });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/approvals/:id/decide", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("approvals.act");
    const input = DecideApprovalSchema.parse({ ...req.body, organizationId: orgId(req) });
    const ip =
      typeof req.headers["x-forwarded-for"] === "string"
        ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
        : req.socket.remoteAddress;
    res.json(
      await repo(req).decideApproval(req.params.id!, input, userId(req), {
        ipAddress: ip,
      }),
    );
  } catch (err) {
    next(err);
  }
});

// 28 Audit Trail
adminRouter.get("/audit", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("audit.view");
    const limit = Number(req.query.limit ?? 100);
    res.json({ items: await repo(req).listAuditLogs(orgId(req), limit) });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/audit", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("audit.view");
    const input = CreateAuditLogAdminSchema.parse({
      ...req.body,
      organizationId: orgId(req),
      actorUserId: req.body.actorUserId ?? userId(req),
    });
    res.status(201).json(await repo(req).writeAudit(input));
  } catch (err) {
    next(err);
  }
});
