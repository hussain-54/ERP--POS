import {
  type AuthorizationContext,
  canAccessBranch,
} from "@electronic-erp/contracts";
import { ForbiddenDomainError } from "./errors.js";
import { permissionSatisfied } from "./rbac-catalog.js";

export class AuthorizationService {
  constructor(private readonly ctx: AuthorizationContext) {}

  get context(): AuthorizationContext {
    return this.ctx;
  }

  can(permission: string): boolean {
    return permissionSatisfied(this.ctx.permissions, permission);
  }

  assert(permission: string): void {
    if (!this.can(permission)) {
      throw new ForbiddenDomainError(`Missing permission: ${permission}`);
    }
  }

  assertBranch(branchId: string): void {
    if (!canAccessBranch(this.ctx, branchId)) {
      throw new ForbiddenDomainError("Branch access denied");
    }
  }

  /** Owner / super-admin centralized group access. */
  canViewAllBranches(): boolean {
    return this.can("branches.view_all") || this.can("dashboard.group_view");
  }

  assertBranchOrAll(branchId?: string | null): void {
    if (!branchId) {
      if (!this.canViewAllBranches()) {
        throw new ForbiddenDomainError("Branch required");
      }
      return;
    }
    this.assertBranch(branchId);
  }
}
