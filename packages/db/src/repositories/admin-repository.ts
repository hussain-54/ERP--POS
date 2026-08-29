import type {
  AssignUserRoleInput,
  CreateApprovalRequestInput,
  CreateAuditLogAdminInput,
  CreateBranchAdminInput,
  DecideApprovalInput,
  SetBranchMembershipInput,
  SetRolePermissionsInput,
  SetUserPermissionInput,
} from "@electronic-erp/contracts";
import {
  applyApprovalDecision,
  buildAuditRow,
  defaultPermissionsForRole,
  initialApproverStepIndex,
  requiredRoleAtStep,
  SYSTEM_ROLES,
  type SystemRoleCode,
  ValidationDomainError,
} from "@electronic-erp/domain";
import type { DatabaseClient } from "../client.js";

type Row = Record<string, unknown>;

export class AdminRepository {
  constructor(private readonly db: DatabaseClient) {}

  async seedSystemRoles(organizationId: string) {
    const roles: Row[] = [];
    for (const def of SYSTEM_ROLES) {
      const { data: role, error } = await this.db
        .from("roles")
        .upsert(
          {
            organization_id: organizationId,
            code: def.code,
            name: def.name,
            description: def.description,
            is_system: true,
          },
          { onConflict: "organization_id,code" },
        )
        .select("*")
        .single();
      if (error) throw error;

      const keys = defaultPermissionsForRole(def.code as SystemRoleCode);
      await this.replaceRolePermissions(String(role.id), keys);
      roles.push(role);
    }
    return roles;
  }

  async listRoles(organizationId: string) {
    const { data, error } = await this.db
      .from("roles")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name");
    if (error) throw error;
    return data ?? [];
  }

  async listPermissions() {
    const { data, error } = await this.db.from("permissions").select("*").order("key");
    if (error) throw error;
    return data ?? [];
  }

  async listRolePermissions(roleId: string) {
    const { data, error } = await this.db
      .from("role_permissions")
      .select("permission_id, permissions(key,module,action)")
      .eq("role_id", roleId);
    if (error) throw error;
    return data ?? [];
  }

  async setRolePermissions(input: SetRolePermissionsInput) {
    await this.replaceRolePermissions(input.roleId, input.permissionKeys);
    return this.listRolePermissions(input.roleId);
  }

  async listUsers(organizationId: string) {
    const { data, error } = await this.db
      .from("user_profiles")
      .select("*, default_branch:branches(id,name,code)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("full_name");
    if (error) throw error;
    return data ?? [];
  }

  async listDetailedUsers(organizationId: string) {
    const { data: profiles, error: pErr } = await this.db
      .from("user_profiles")
      .select("*, default_branch:branches(id,name,code)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (pErr) throw pErr;

    const userIds = (profiles ?? []).map((p) => String(p.id));
    if (userIds.length === 0) return [];

    const [{ data: userRoles }, { data: memberships }] = await Promise.all([
      this.db
        .from("user_roles")
        .select("id, user_id, role_id, branch_id, roles(id,code,name)")
        .in("user_id", userIds),
      this.db
        .from("branch_memberships")
        .select("id, user_id, branch_id, branches(id,name,code)")
        .in("user_id", userIds),
    ]);

    const rolesByUser = new Map<string, Array<Record<string, unknown>>>();
    for (const r of userRoles ?? []) {
      const uid = String(r.user_id);
      if (!rolesByUser.has(uid)) rolesByUser.set(uid, []);
      rolesByUser.get(uid)!.push(r as Record<string, unknown>);
    }

    const branchesByUser = new Map<string, Array<Record<string, unknown>>>();
    for (const b of memberships ?? []) {
      const uid = String(b.user_id);
      if (!branchesByUser.has(uid)) branchesByUser.set(uid, []);
      branchesByUser.get(uid)!.push(b as Record<string, unknown>);
    }

    return (profiles ?? []).map((p) => {
      const uid = String(p.id);
      return {
        ...p,
        roles: rolesByUser.get(uid) ?? [],
        branches: branchesByUser.get(uid) ?? [],
      };
    });
  }

  async updateUser(input: {
    organizationId: string;
    userId: string;
    fullName?: string;
    phone?: string | null;
    isActive?: boolean;
    defaultBranchId?: string | null;
  }) {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.fullName !== undefined) patch.full_name = input.fullName;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.isActive !== undefined) patch.is_active = input.isActive;
    if (input.defaultBranchId !== undefined) patch.default_branch_id = input.defaultBranchId;

    const { data, error } = await this.db
      .from("user_profiles")
      .update(patch)
      .eq("id", input.userId)
      .eq("organization_id", input.organizationId)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listUserRoles(userId: string) {
    const { data, error } = await this.db
      .from("user_roles")
      .select("*, roles(code,name)")
      .eq("user_id", userId);
    if (error) throw error;
    return data ?? [];
  }

  async assignUserRole(input: AssignUserRoleInput) {
    let roleId = input.roleId;
    if (!roleId && input.roleCode) {
      const { data: role } = await this.db
        .from("roles")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("code", input.roleCode)
        .maybeSingle();
      if (!role) {
        await this.seedSystemRoles(input.organizationId);
        const { data: seeded } = await this.db
          .from("roles")
          .select("id")
          .eq("organization_id", input.organizationId)
          .eq("code", input.roleCode)
          .maybeSingle();
        roleId = seeded ? String(seeded.id) : undefined;
      } else {
        roleId = String(role.id);
      }
    }
    if (!roleId) throw new ValidationDomainError("roleId or roleCode required");

    const { data, error } = await this.db
      .from("user_roles")
      .upsert(
        {
          organization_id: input.organizationId,
          user_id: input.userId,
          role_id: roleId,
          branch_id: input.branchId ?? null,
        },
        { onConflict: "user_id,role_id,branch_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async removeUserRole(userRoleId: string) {
    const { error } = await this.db.from("user_roles").delete().eq("id", userRoleId);
    if (error) throw error;
    return { ok: true };
  }

  async setUserPermission(input: SetUserPermissionInput, actorUserId?: string | null) {
    const { data: perm } = await this.db
      .from("permissions")
      .select("id")
      .eq("key", input.permissionKey)
      .maybeSingle();
    if (!perm) throw new ValidationDomainError(`Unknown permission ${input.permissionKey}`);

    const { data, error } = await this.db
      .from("user_permissions")
      .upsert(
        {
          organization_id: input.organizationId,
          user_id: input.userId,
          permission_id: perm.id,
          branch_id: input.branchId ?? null,
          effect: input.effect,
          created_by: actorUserId ?? null,
        },
        { onConflict: "user_id,permission_id,branch_id,effect" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listUserPermissions(userId: string) {
    const { data, error } = await this.db
      .from("user_permissions")
      .select("*, permissions(key)")
      .eq("user_id", userId);
    if (error) throw error;
    return data ?? [];
  }

  async listBranches(organizationId: string) {
    const { data, error } = await this.db
      .from("branches")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name");
    if (error) throw error;
    return data ?? [];
  }

  async createBranch(input: CreateBranchAdminInput, userId?: string | null) {
    const settings = { is_main: Boolean(input.isMain) };
    const { data, error } = await this.db
      .from("branches")
      .insert({
        organization_id: input.organizationId,
        code: input.code,
        name: input.name,
        address: input.address ?? null,
        settings,
        created_by: userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async setBranchMembership(input: SetBranchMembershipInput) {
    if (!input.assign) {
      await this.db
        .from("branch_memberships")
        .delete()
        .eq("user_id", input.userId)
        .eq("branch_id", input.branchId);
      return { ok: true, assigned: false };
    }
    const { data, error } = await this.db
      .from("branch_memberships")
      .upsert(
        {
          organization_id: input.organizationId,
          user_id: input.userId,
          branch_id: input.branchId,
        },
        { onConflict: "user_id,branch_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async groupDashboard(organizationId: string) {
    const branches = await this.listBranches(organizationId);
    const summaries = [];
    for (const b of branches) {
      const branchId = String(b.id);
      const [sales, purchases, expenses, customers, stock] = await Promise.all([
        this.countEq("sales", organizationId, branchId),
        this.countEq("purchases", organizationId, branchId),
        this.countEq("expenses", organizationId, branchId),
        this.countEq("customers", organizationId),
        this.sumStock(organizationId, branchId),
      ]);
      summaries.push({
        branchId,
        code: b.code,
        name: b.name,
        isMain: Boolean((b.settings as Row | null)?.is_main),
        sales,
        purchases,
        expenses,
        customers,
        stockQty: stock,
      });
    }
    return { branches: summaries };
  }

  async createApprovalRequest(input: CreateApprovalRequestInput, userId?: string | null) {
    const currentStep = initialApproverStepIndex(input.workflowType);
    const { data: req, error } = await this.db
      .from("approval_requests")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId ?? null,
        workflow_type: input.workflowType,
        status: "pending",
        current_step: currentStep,
        requester_user_id: userId ?? null,
        requester_role: input.requesterRole ?? null,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        title: input.title,
        payload: input.payload ?? {},
        amount: input.amount ?? null,
        remarks: input.remarks ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    const submitRole = input.requesterRole ?? "employee";
    const { data: action } = await this.db
      .from("approval_actions")
      .insert({
        organization_id: input.organizationId,
        approval_request_id: req.id,
        step_index: 0,
        required_role: submitRole,
        actor_user_id: userId ?? null,
        action: "submit",
        status: "pending",
        remarks: input.remarks ?? null,
      })
      .select("*")
      .single();

    const audit = await this.writeAudit({
      organizationId: input.organizationId,
      branchId: input.branchId,
      actorUserId: userId ?? undefined,
      actorRole: submitRole,
      actorKind: "creator",
      action: "approval.submit",
      entityType: "approval_request",
      entityId: String(req.id),
      after: { workflowType: input.workflowType, title: input.title },
      remarks: input.remarks,
    });

    if (action) {
      await this.db
        .from("approval_actions")
        .update({ audit_log_id: audit.id })
        .eq("id", action.id);
    }

    return req;
  }

  async listApprovals(organizationId: string, status?: string) {
    let q = this.db
      .from("approval_requests")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async listApprovalActions(requestId: string) {
    const { data, error } = await this.db
      .from("approval_actions")
      .select("*")
      .eq("approval_request_id", requestId)
      .order("step_index");
    if (error) throw error;
    return data ?? [];
  }

  async decideApproval(
    requestId: string,
    input: DecideApprovalInput,
    userId?: string | null,
    meta?: { ipAddress?: string; deviceId?: string },
  ) {
    const { data: req, error } = await this.db
      .from("approval_requests")
      .select("*")
      .eq("id", requestId)
      .eq("organization_id", input.organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!req) throw new ValidationDomainError("Approval request not found");

    const result = applyApprovalDecision({
      workflow: req.workflow_type as never,
      currentStep: Number(req.current_step),
      status: req.status as never,
      actorRoles: input.actorRoles,
      decision: input.decision,
    });

    const required = requiredRoleAtStep(req.workflow_type as never, Number(req.current_step));
    const { data: action } = await this.db
      .from("approval_actions")
      .insert({
        organization_id: input.organizationId,
        approval_request_id: requestId,
        step_index: Number(req.current_step),
        required_role: required,
        actor_user_id: userId ?? null,
        action: input.decision === "cancel" ? "cancel" : input.decision,
        status: result.nextStatus === "pending" ? "approved" : result.nextStatus,
        remarks: input.remarks ?? null,
      })
      .select("*")
      .single();

    const audit = await this.writeAudit({
      organizationId: input.organizationId,
      branchId: req.branch_id ? String(req.branch_id) : undefined,
      actorUserId: userId ?? undefined,
      actorRole: required,
      actorKind: input.decision === "approve" ? "approver" : input.decision === "cancel" ? "canceller" : "other",
      action: `approval.${input.decision}`,
      entityType: "approval_request",
      entityId: requestId,
      before: { status: req.status, step: req.current_step },
      after: {
        status: result.nextStatus,
        step: result.nextStep,
        escalated: result.escalated,
      },
      ipAddress: meta?.ipAddress,
      deviceId: meta?.deviceId,
      remarks: input.remarks,
    });

    if (action) {
      await this.db
        .from("approval_actions")
        .update({ audit_log_id: audit.id })
        .eq("id", action.id);
    }

    const { data: updated, error: updErr } = await this.db
      .from("approval_requests")
      .update({
        status: result.nextStatus,
        current_step: result.nextStep,
        remarks: input.remarks ?? req.remarks,
        decided_at: result.completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select("*")
      .single();
    if (updErr) throw updErr;
    return { request: updated, result };
  }

  async writeAudit(input: CreateAuditLogAdminInput | Parameters<typeof buildAuditRow>[0]) {
    const row = buildAuditRow(input as never);
    const { data, error } = await this.db.from("audit_logs").insert(row).select("*").single();
    if (error) throw error;
    return data;
  }

  async listAuditLogs(organizationId: string, limit = 100) {
    const { data, error } = await this.db
      .from("audit_logs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  private async replaceRolePermissions(roleId: string, keys: string[]) {
    await this.db.from("role_permissions").delete().eq("role_id", roleId);
    if (!keys.length) return;
    const { data: perms } = await this.db.from("permissions").select("id,key").in("key", keys);
    const rows = (perms ?? []).map((p) => ({
      role_id: roleId,
      permission_id: p.id,
    }));
    if (rows.length) {
      const { error } = await this.db.from("role_permissions").insert(rows);
      if (error) throw error;
    }
  }

  private async countEq(table: string, organizationId: string, branchId?: string) {
    let q = this.db
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId);
    if (branchId) q = q.eq("branch_id", branchId);
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  }

  private async sumStock(organizationId: string, branchId: string) {
    try {
      const { data: warehouses } = await this.db
        .from("warehouses")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("branch_id", branchId);
      const ids = (warehouses ?? []).map((w) => String(w.id));
      if (!ids.length) return 0;
      const { data } = await this.db
        .from("stock_balances")
        .select("qty_on_hand")
        .eq("organization_id", organizationId)
        .in("warehouse_id", ids)
        .limit(500);
      return (data ?? []).reduce((s, r) => s + Number(r.qty_on_hand ?? 0), 0);
    } catch {
      return 0;
    }
  }
}
