import { ForbiddenDomainError, ValidationDomainError } from "./errors.js";
import type { SystemRoleCode } from "./rbac-catalog.js";

export type ApprovalWorkflowType =
  | "discount"
  | "purchase"
  | "expense"
  | "return"
  | "credit";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

/**
 * Escalation chains:
 * Discount: Cashier → Manager → Owner
 * Purchase: Storekeeper → Manager → Owner
 * Expense: Employee → Admin → Owner
 * Return: Cashier → Manager
 * Credit: Salesman → Manager → Owner
 */
export const APPROVAL_CHAINS: Record<ApprovalWorkflowType, SystemRoleCode[]> = {
  discount: ["cashier", "manager", "owner"],
  purchase: ["storekeeper", "manager", "owner"],
  expense: ["admin", "owner"], // employee submits; first approver is admin
  return: ["cashier", "manager"],
  credit: ["salesman", "manager", "owner"],
};

/** Role that submits the request (not always the first approver). */
export const APPROVAL_SUBMITTER: Record<ApprovalWorkflowType, SystemRoleCode> = {
  discount: "cashier",
  purchase: "storekeeper",
  expense: "cashier", // any employee; cashier used as generic staff for tests
  return: "cashier",
  credit: "salesman",
};

export type ApprovalActionType = "submit" | "approve" | "reject" | "escalate" | "cancel";

export interface ApprovalStepState {
  stepIndex: number;
  requiredRole: SystemRoleCode;
  status: ApprovalStatus | "submitted";
}

export function buildApprovalSteps(workflow: ApprovalWorkflowType): ApprovalStepState[] {
  const chain = APPROVAL_CHAINS[workflow];
  // First role in chain is submitter for discount/purchase/return/credit;
  // for expense chain starts at admin (approver).
  if (workflow === "expense") {
    return chain.map((role, stepIndex) => ({
      stepIndex,
      requiredRole: role,
      status: "pending" as const,
    }));
  }
  // Submitter is chain[0]; first pending approver is chain[1] if present else chain[0] self-approve path
  return chain.map((role, stepIndex) => ({
    stepIndex,
    requiredRole: role,
    status: stepIndex === 0 ? ("submitted" as const) : ("pending" as const),
  }));
}

export function initialApproverStepIndex(workflow: ApprovalWorkflowType): number {
  if (workflow === "expense") return 0;
  // After submit by chain[0], waiting on chain[1] (or 0 if single-step — shouldn't happen)
  return APPROVAL_CHAINS[workflow].length > 1 ? 1 : 0;
}

export function requiredRoleAtStep(
  workflow: ApprovalWorkflowType,
  stepIndex: number,
): SystemRoleCode {
  const chain = APPROVAL_CHAINS[workflow];
  const role = chain[stepIndex];
  if (!role) throw new ValidationDomainError(`Invalid approval step ${stepIndex}`);
  return role;
}

export function canActOnApproval(input: {
  workflow: ApprovalWorkflowType;
  currentStep: number;
  status: ApprovalStatus;
  actorRoles: string[];
}): boolean {
  if (input.status !== "pending") return false;
  const required = requiredRoleAtStep(input.workflow, input.currentStep);
  return (
    input.actorRoles.includes(required) ||
    input.actorRoles.includes("owner") ||
    input.actorRoles.includes("super_admin")
  );
}

export function applyApprovalDecision(input: {
  workflow: ApprovalWorkflowType;
  currentStep: number;
  status: ApprovalStatus;
  actorRoles: string[];
  decision: "approve" | "reject" | "cancel";
}): {
  nextStatus: ApprovalStatus;
  nextStep: number;
  escalated: boolean;
  completed: boolean;
} {
  if (input.status !== "pending") {
    throw new ValidationDomainError("Approval is not pending");
  }
  if (input.decision === "cancel") {
    return { nextStatus: "cancelled", nextStep: input.currentStep, escalated: false, completed: true };
  }
  if (!canActOnApproval(input)) {
    throw new ForbiddenDomainError(
      `Role cannot act on ${input.workflow} step ${input.currentStep}`,
    );
  }
  if (input.decision === "reject") {
    return { nextStatus: "rejected", nextStep: input.currentStep, escalated: false, completed: true };
  }

  const chain = APPROVAL_CHAINS[input.workflow];
  const isOwnerOverride =
    input.actorRoles.includes("owner") || input.actorRoles.includes("super_admin");
  const next = input.currentStep + 1;
  if (isOwnerOverride || next >= chain.length) {
    return { nextStatus: "approved", nextStep: input.currentStep, escalated: false, completed: true };
  }
  return {
    nextStatus: "pending",
    nextStep: next,
    escalated: true,
    completed: false,
  };
}

export function assertEscalationPath(workflow: ApprovalWorkflowType): SystemRoleCode[] {
  const chain = APPROVAL_CHAINS[workflow];
  if (chain.length < 2 && workflow !== "return") {
    // return is Cashier → Manager (2); all others ≥2
  }
  if (workflow === "discount") {
    expectChain(chain, ["cashier", "manager", "owner"]);
  }
  if (workflow === "purchase") {
    expectChain(chain, ["storekeeper", "manager", "owner"]);
  }
  if (workflow === "expense") {
    expectChain(chain, ["admin", "owner"]);
  }
  if (workflow === "return") {
    expectChain(chain, ["cashier", "manager"]);
  }
  if (workflow === "credit") {
    expectChain(chain, ["salesman", "manager", "owner"]);
  }
  return chain;
}

function expectChain(actual: SystemRoleCode[], expected: SystemRoleCode[]) {
  if (actual.length !== expected.length || actual.some((r, i) => r !== expected[i])) {
    throw new ValidationDomainError(
      `Invalid chain: expected ${expected.join("→")}, got ${actual.join("→")}`,
    );
  }
}
