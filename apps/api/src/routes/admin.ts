import { Router } from "express";
import {
  AssignUserRoleSchema,
  CreateApprovalRequestSchema,
  CreateAuditLogAdminSchema,
  CreateBranchAdminSchema,
  DecideApprovalSchema,
  SetBranchMembershipSchema,
  SetRolePermissionsSchema,
  SetUserPermissionSchema,
} from "@electronic-erp/contracts";
import { AdminRepository } from "@electronic-erp/db";
import { AuthorizationService } from "@electronic-erp/domain";
import { createUserClient } from "../lib/supabase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

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

adminRouter.get("/users", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("users.manage");
    res.json({ items: await repo(req).listUsers(orgId(req)) });
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

adminRouter.get("/dashboard/group", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("dashboard.group_view");
    res.json(await repo(req).groupDashboard(orgId(req)));
  } catch (err) {
    next(err);
  }
});

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
