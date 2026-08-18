import type { ApproverRole } from "@electronic-erp/contracts";
import {
  applyDiscount,
  APPROVAL_CHAINS,
  canActOnApproval,
  DISCOUNT_LIMITS,
  evaluateDiscountApproval,
  maxDiscountPercentForRole,
  requiredRoleAtStep,
  roleCanApprovePercent,
  type AppliedDiscount,
  type ApprovalStatus,
  type DiscountApprovalDecision,
  type DiscountMode,
} from "@electronic-erp/domain";
import type { POSBadgeTone } from "./design-system";

export const DISCOUNT_TABLE_COLUMNS = [
  "Discount Type",
  "Value",
  "Maximum Allowed",
  "Approval Required",
  "Status",
] as const;

export const DISCOUNT_WORKFLOW_STEPS = APPROVAL_CHAINS.discount.map((role) => ({
  id: role,
  label: role.charAt(0).toUpperCase() + role.slice(1),
}));

export type DiscountPolicyRow = {
  id: string;
  discountType: string;
  value: string;
  maximumAllowed: string;
  approvalRequired: string;
  status: string;
  statusTone: POSBadgeTone;
};

export type PendingDiscountRequest =
  | {
      kind: "invoice" | "line";
      key?: string;
      raw: string;
      mode: DiscountMode;
      value: number;
      amount: number;
      base: number;
      percent: number;
      requiredRole: ApproverRole;
      maxAllowed: number;
    }
  | {
      kind: "price";
      key?: string;
      unitPrice?: number;
    };

export type DiscountApprovalRow = {
  id: string;
  title: string;
  amount: number | null;
  status: ApprovalStatus;
  currentStep: number;
  requiredRole: string;
  requesterRole: string;
  createdAt: string | null;
  remarks: string;
};

export function formatDiscountCap(max: number): string {
  return max === Number.POSITIVE_INFINITY ? "Unlimited" : `${max}%`;
}

export function parseDiscountValueInput(raw: string): { mode: DiscountMode; value: number } {
  const trimmed = raw.trim();
  const percent = trimmed.endsWith("%");
  const numeric = Number(percent ? trimmed.slice(0, -1) : trimmed);
  return {
    mode: percent ? "percentage" : "fixed",
    value: Number.isFinite(numeric) ? numeric : 0,
  };
}

/** Domain applyDiscount + evaluateDiscountApproval — never a second grand-total engine. */
export function evaluateDiscountAgainstPolicy(input: {
  base: number;
  mode: DiscountMode;
  value: number;
  actingRole: ApproverRole;
}): { applied: AppliedDiscount; decision: DiscountApprovalDecision } {
  const applied = applyDiscount({
    base: input.base,
    mode: input.mode,
    value: input.value,
    kind: input.mode === "percentage" ? "percentage" : "fixed",
  });
  return {
    applied,
    decision: evaluateDiscountApproval({
      discountAmount: applied.amount,
      baseAmount: input.base,
      actingRole: input.actingRole,
    }),
  };
}

export function buildDiscountPolicyRows(input: {
  actingRole: ApproverRole;
  canPriceOverride: boolean;
}): DiscountPolicyRow[] {
  const cap = formatDiscountCap(maxDiscountPercentForRole(input.actingRole));
  const overCap = `Yes — if over ${cap} for ${input.actingRole}`;

  const permissionRows: DiscountPolicyRow[] = (Object.keys(DISCOUNT_LIMITS) as ApproverRole[]).map(
    (role) => {
      const max = formatDiscountCap(DISCOUNT_LIMITS[role]);
      const within = roleCanApprovePercent(input.actingRole, finiteCap(DISCOUNT_LIMITS[role]));
      return {
        id: `permission-${role}`,
        discountType: `Permission-based (${role})`,
        value: role === "special" ? "Any percent within applyDiscount cap" : `Up to ${max} of base`,
        maximumAllowed: max,
        approvalRequired: within ? "No — within your permission" : `Yes — requires ${role}`,
        status: within ? "Within your cap" : "Requires higher role",
        statusTone: within ? "success" : "warning",
      };
    },
  );

  return [
    {
      id: "line-percentage",
      discountType: "Line discount — percentage",
      value: "0–100% of line gross",
      maximumAllowed: cap,
      approvalRequired: overCap,
      status: "Enforced",
      statusTone: "primary",
    },
    {
      id: "line-fixed",
      discountType: "Line discount — fixed amount",
      value: "Money, never above line gross",
      maximumAllowed: cap,
      approvalRequired: overCap,
      status: "Enforced",
      statusTone: "primary",
    },
    {
      id: "invoice-percentage",
      discountType: "Invoice discount — percentage",
      value: "0–100% of invoice base",
      maximumAllowed: cap,
      approvalRequired: overCap,
      status: "Enforced",
      statusTone: "primary",
    },
    {
      id: "invoice-fixed",
      discountType: "Invoice discount — fixed amount",
      value: "Money, never above invoice base",
      maximumAllowed: cap,
      approvalRequired: overCap,
      status: "Enforced",
      statusTone: "primary",
    },
    ...permissionRows,
    {
      id: "max-policy",
      discountType: "Maximum discount policy",
      value: "Inclusive role ladder on sale post",
      maximumAllowed: cap,
      approvalRequired: "Always when the percent exceeds the acting role",
      status: "Never bypassed",
      statusTone: "danger",
    },
    {
      id: "price-override",
      discountType: "Price Override",
      value: "Manual unit price on New Sale",
      maximumAllowed: "Manager / Owner / Special",
      approvalRequired: input.canPriceOverride ? "No — permission held" : "Yes — permission required",
      status: input.canPriceOverride ? "Available" : "Blocked",
      statusTone: input.canPriceOverride ? "success" : "danger",
    },
    {
      id: "pricing-engine",
      discountType: "Customer / wholesale / promotion / bulk",
      value: "From pricing resolver, not cashier entry",
      maximumAllowed: cap,
      approvalRequired: "If the posted % exceeds the acting role cap",
      status: "Enforced on sale post",
      statusTone: "neutral",
    },
  ];
}

function finiteCap(max: number): number {
  return max === Number.POSITIVE_INFINITY ? 100 : max;
}

export function sessionActorRolesForDiscountWorkflow(perms: {
  special?: boolean;
  owner?: boolean;
  manager?: boolean;
  supervisor?: boolean;
  cashier?: boolean;
}): string[] {
  const roles: string[] = [];
  if (perms.special || perms.owner) roles.push("owner");
  if (perms.manager) roles.push("manager");
  if (perms.cashier || perms.supervisor) roles.push("cashier");
  return roles.length ? roles : ["cashier"];
}

export function approvalStatusTone(status: string): POSBadgeTone {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected") return "danger";
  return "neutral";
}

function asApprovalStatus(value: string): ApprovalStatus {
  if (value === "approved" || value === "rejected" || value === "cancelled" || value === "pending") {
    return value;
  }
  return "pending";
}

export function parseDiscountApproval(row: Record<string, unknown>): DiscountApprovalRow | null {
  const workflow = String(row.workflow_type ?? row.workflowType ?? "");
  if (workflow !== "discount") return null;
  const id = String(row.id ?? "");
  if (!id) return null;
  const currentStep = Number(row.current_step ?? row.currentStep ?? 0);
  let requiredRole = "—";
  try {
    requiredRole = requiredRoleAtStep("discount", Number.isFinite(currentStep) ? currentStep : 0);
  } catch {
    requiredRole = "—";
  }
  const amountRaw = row.amount;
  const amount =
    typeof amountRaw === "number"
      ? amountRaw
      : amountRaw != null && amountRaw !== ""
        ? Number(amountRaw)
        : null;
  return {
    id,
    title: String(row.title ?? "Discount approval"),
    amount: amount != null && Number.isFinite(amount) ? amount : null,
    status: asApprovalStatus(String(row.status ?? "pending")),
    currentStep: Number.isFinite(currentStep) ? currentStep : 0,
    requiredRole,
    requesterRole: String(row.requester_role ?? row.requesterRole ?? "cashier"),
    createdAt: row.created_at != null ? String(row.created_at) : row.createdAt != null ? String(row.createdAt) : null,
    remarks: String(row.remarks ?? ""),
  };
}

export function canDecideDiscountApproval(row: DiscountApprovalRow, actorRoles: string[]): boolean {
  return canActOnApproval({
    workflow: "discount",
    currentStep: row.currentStep,
    status: row.status,
    actorRoles,
  });
}

export function buildDiscountApprovalCreateBody(input: {
  branchId?: string;
  title: string;
  amount?: number;
  remarks: string;
  requesterRole: string;
  payload: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    branchId: input.branchId,
    workflowType: "discount",
    entityType: "pos_discount",
    title: input.title,
    amount: input.amount,
    remarks: input.remarks,
    requesterRole: input.requesterRole,
    payload: input.payload,
  };
}

export function discountRequestTitle(request: PendingDiscountRequest): string {
  if (request.kind === "price") return "POS price override";
  const scope = request.kind === "invoice" ? "Invoice" : "Line";
  return `${scope} discount ${request.percent}% requires ${request.requiredRole}`;
}
