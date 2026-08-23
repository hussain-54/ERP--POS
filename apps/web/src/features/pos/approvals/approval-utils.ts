import { canActOnApproval, requiredRoleAtStep, type ApprovalWorkflowType } from "@electronic-erp/domain";

/** Map session permissions to system role codes for approval API — server validates via canActOnApproval. */
export function approvalActorRolesFromPermissions(permissions: string[]): string[] {
  const roles: string[] = [];
  if (permissions.includes("roles.manage") || permissions.includes("approvals.manage")) {
    roles.push("owner", "super_admin");
  }
  if (permissions.includes("pos.discount_owner") || permissions.includes("pos.discount_special")) {
    roles.push("owner");
  }
  if (
    permissions.includes("pos.discount_manager") ||
    permissions.includes("approvals.act") ||
    permissions.includes("credit.approve")
  ) {
    roles.push("manager");
  }
  if (permissions.includes("pos.discount_supervisor")) roles.push("supervisor");
  if (permissions.includes("purchases.write") || permissions.includes("purchases.return")) {
    roles.push("storekeeper");
  }
  if (permissions.includes("credit.manage")) roles.push("salesman");
  if (
    permissions.includes("pos.sell") ||
    permissions.includes("pos.return") ||
    permissions.includes("pos.discount_cashier")
  ) {
    roles.push("cashier");
  }
  if (permissions.includes("expenses.manage")) roles.push("admin");
  return [...new Set(roles)];
}

export function canDecideApproval(input: {
  workflow: ApprovalWorkflowType;
  currentStep: number;
  status: string;
  permissions: string[];
}): boolean {
  if (input.status !== "pending") return false;
  const actorRoles = approvalActorRolesFromPermissions(input.permissions);
  return canActOnApproval({
    workflow: input.workflow,
    currentStep: input.currentStep,
    status: "pending",
    actorRoles,
  });
}

export function requiredApproverLabel(workflow: ApprovalWorkflowType, step: number): string {
  try {
    return requiredRoleAtStep(workflow, step);
  } catch {
    return "approver";
  }
}

export type PosApprovalMode =
  | "all"
  | "discount"
  | "price-override"
  | "void"
  | "refund"
  | "return"
  | "exchange"
  | "credit"
  | "cash";

export const APPROVAL_MODE_META: Record<
  PosApprovalMode,
  { title: string; description: string; workflowTypes: ApprovalWorkflowType[]; keyword?: string }
> = {
  all: { title: "All approvals", description: "Pending and recent approval requests.", workflowTypes: [] },
  discount: {
    title: "Discount approval",
    description: "Discounts above cashier limits.",
    workflowTypes: ["discount"],
  },
  "price-override": {
    title: "Price override",
    description: "Manager approval for manual price overrides.",
    workflowTypes: ["discount"],
    keyword: "override",
  },
  void: {
    title: "Void approval",
    description: "Sale void requests — workflow type not yet on server; shown when submitted as discount/return.",
    workflowTypes: ["discount", "return"],
    keyword: "void",
  },
  refund: {
    title: "Refund approval",
    description: "Refund and return settlement approvals.",
    workflowTypes: ["return"],
    keyword: "refund",
  },
  return: {
    title: "Return approval",
    description: "Sales return requests (Cashier → Manager).",
    workflowTypes: ["return"],
  },
  exchange: {
    title: "Exchange approval",
    description: "Exchange requests linked to return workflow.",
    workflowTypes: ["return"],
    keyword: "exchange",
  },
  credit: {
    title: "Credit approval",
    description: "Credit sale and udhar limits.",
    workflowTypes: ["credit"],
  },
  cash: {
    title: "Cash adjustment",
    description: "Cash drawer adjustments via expense workflow.",
    workflowTypes: ["expense"],
    keyword: "cash",
  },
};

export function filterApprovalsForMode(
  items: Array<Record<string, unknown>>,
  mode: PosApprovalMode,
): Array<Record<string, unknown>> {
  const meta = APPROVAL_MODE_META[mode];
  if (mode === "all") return items;
  return items.filter((row) => {
    const wt = String(row.workflow_type ?? "");
    if (!meta.workflowTypes.includes(wt as ApprovalWorkflowType)) return false;
    if (!meta.keyword) return true;
    const hay = `${row.title ?? ""} ${row.remarks ?? ""} ${JSON.stringify(row.payload ?? {})}`.toLowerCase();
    return hay.includes(meta.keyword);
  });
}

export function formatApprovalStatus(status: string): string {
  return status.replace(/_/g, " ");
}
