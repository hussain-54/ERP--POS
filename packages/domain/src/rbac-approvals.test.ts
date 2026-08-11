import { describe, expect, it } from "vitest";
import {
  applyApprovalDecision,
  APPROVAL_CHAINS,
  assertEscalationPath,
  canActOnApproval,
  initialApproverStepIndex,
} from "./approval-workflow.js";
import { buildAuditRow, auditActionForKind } from "./audit-trail.js";
import { AuthorizationService } from "./authz-service.js";
import {
  defaultPermissionsForRole,
  MODULE_ACTIONS,
  permissionSatisfied,
  RBAC_MODULES,
  SYSTEM_ROLES,
} from "./rbac-catalog.js";
import { ForbiddenDomainError } from "./errors.js";

describe("RBAC roles", () => {
  it("defines all 12 system roles", () => {
    expect(SYSTEM_ROLES).toHaveLength(12);
    expect(SYSTEM_ROLES.map((r) => r.code)).toEqual([
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
  });

  it("assigns non-empty default permissions for every role", () => {
    for (const role of SYSTEM_ROLES) {
      const perms = defaultPermissionsForRole(role.code);
      expect(perms.length).toBeGreaterThan(0);
    }
  });

  it("owner has group dashboard and view-all branches; cashier does not", () => {
    const owner = defaultPermissionsForRole("owner");
    const cashier = defaultPermissionsForRole("cashier");
    expect(owner).toContain("dashboard.group_view");
    expect(owner).toContain("branches.view_all");
    expect(cashier).not.toContain("branches.view_all");
    expect(cashier).toContain("pos.sell");
  });

  it("supports standard module actions across modules", () => {
    expect(MODULE_ACTIONS).toEqual([
      "view",
      "add",
      "edit",
      "delete",
      "approve",
      "reject",
      "print",
      "export",
      "import",
      "cancel",
      "refund",
    ]);
    expect(RBAC_MODULES.length).toBeGreaterThan(10);
  });

  it("permission aliases satisfy legacy route checks", () => {
    expect(permissionSatisfied(["products.view"], "products.read")).toBe(true);
    expect(permissionSatisfied(["products.write"], "products.add")).toBe(true);
    expect(permissionSatisfied(["pos.sell"], "products.read")).toBe(false);
  });
});

describe("branch isolation", () => {
  const branchA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const branchB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("denies cross-branch access without view_all", () => {
    const svc = new AuthorizationService({
      userId: "11111111-1111-4111-8111-111111111111",
      organizationId: "22222222-2222-4222-8222-222222222222",
      branchId: branchA,
      permissions: ["pos.sell"],
      branchIds: [branchA],
    });
    expect(() => svc.assertBranch(branchB)).toThrow(ForbiddenDomainError);
  });

  it("allows cross-branch access with branches.view_all", () => {
    const svc = new AuthorizationService({
      userId: "11111111-1111-4111-8111-111111111111",
      organizationId: "22222222-2222-4222-8222-222222222222",
      branchId: branchA,
      permissions: ["branches.view_all", "dashboard.group_view"],
      branchIds: [branchA],
    });
    expect(() => svc.assertBranch(branchB)).not.toThrow();
    expect(svc.can("branches.view_all")).toBe(true);
    expect(svc.can("dashboard.group_view")).toBe(true);
  });
});

describe("approval escalation", () => {
  it("encodes required escalation chains", () => {
    assertEscalationPath("discount");
    assertEscalationPath("purchase");
    assertEscalationPath("expense");
    assertEscalationPath("return");
    assertEscalationPath("credit");
    expect(APPROVAL_CHAINS.discount).toEqual(["cashier", "manager", "owner"]);
    expect(APPROVAL_CHAINS.purchase).toEqual(["storekeeper", "manager", "owner"]);
    expect(APPROVAL_CHAINS.expense).toEqual(["admin", "owner"]);
    expect(APPROVAL_CHAINS.return).toEqual(["cashier", "manager"]);
    expect(APPROVAL_CHAINS.credit).toEqual(["salesman", "manager", "owner"]);
  });

  it("escalates discount Cashier→Manager→Owner", () => {
    const step = initialApproverStepIndex("discount");
    expect(step).toBe(1);
    expect(canActOnApproval({
      workflow: "discount",
      currentStep: step,
      status: "pending",
      actorRoles: ["cashier"],
    })).toBe(false);
    expect(canActOnApproval({
      workflow: "discount",
      currentStep: step,
      status: "pending",
      actorRoles: ["manager"],
    })).toBe(true);

    const mid = applyApprovalDecision({
      workflow: "discount",
      currentStep: 1,
      status: "pending",
      actorRoles: ["manager"],
      decision: "approve",
    });
    expect(mid.escalated).toBe(true);
    expect(mid.nextStep).toBe(2);
    expect(mid.nextStatus).toBe("pending");

    const final = applyApprovalDecision({
      workflow: "discount",
      currentStep: 2,
      status: "pending",
      actorRoles: ["owner"],
      decision: "approve",
    });
    expect(final.completed).toBe(true);
    expect(final.nextStatus).toBe("approved");
  });

  it("rejects when actor role cannot decide", () => {
    expect(() =>
      applyApprovalDecision({
        workflow: "purchase",
        currentStep: 1,
        status: "pending",
        actorRoles: ["cashier"],
        decision: "approve",
      }),
    ).toThrow(ForbiddenDomainError);
  });
});

describe("audit trail", () => {
  it("builds append-oriented audit rows with old/new values and actor kind", () => {
    const row = buildAuditRow({
      organizationId: "22222222-2222-4222-8222-222222222222",
      actorUserId: "11111111-1111-4111-8111-111111111111",
      actorKind: "approver",
      actorRole: "manager",
      action: auditActionForKind("approver", "approval_request"),
      entityType: "approval_request",
      entityId: "33333333-3333-4333-8333-333333333333",
      before: { status: "pending" },
      after: { status: "approved" },
      ipAddress: "127.0.0.1",
      remarks: "ok",
    });
    expect(row.action).toBe("approval_request.approve");
    expect(row.before).toEqual({ status: "pending" });
    expect((row.after as Record<string, unknown>).status).toBe("approved");
    expect((row.after as Record<string, unknown>).remarks).toBe("ok");
    expect(row.ip_address).toBe("127.0.0.1");
    expect(row.actor_kind).toBe("approver");
  });
});
