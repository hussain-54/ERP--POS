import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApproverRole } from "@electronic-erp/contracts";
import {
  APPROVAL_CHAINS,
  approverRoleFromPermissions,
  maxDiscountPercentForRole,
} from "@electronic-erp/domain";
import { useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { adminApi } from "@/features/users/admin-api";
import {
  approvalStatusTone,
  buildDiscountApprovalCreateBody,
  buildDiscountPolicyRows,
  canDecideDiscountApproval,
  DISCOUNT_TABLE_COLUMNS,
  DISCOUNT_WORKFLOW_STEPS,
  evaluateDiscountAgainstPolicy,
  formatDiscountCap,
  parseDiscountApproval,
  parseDiscountValueInput,
  sessionActorRolesForDiscountWorkflow,
  type DiscountApprovalRow,
} from "./discounts-workspace";
import {
  POSBadge,
  POSBreadcrumb,
  POSButton,
  POSCard,
  POSEmptyState,
  POSInput,
  POSLoadingState,
  POSPageHeader,
  POSSection,
  POSSelect,
  POSStatCard,
  POSStepper,
  POSTable,
  POSTableBody,
  POSTableHead,
  POSTd,
  POSTh,
} from "./design-system";

export function DiscountsPage() {
  const toast = useToast();
  const { branchId, hasPermission } = useAuth();
  const actingRole: ApproverRole = approverRoleFromPermissions({
    special: hasPermission("pos.discount_special"),
    owner: hasPermission("pos.discount_owner"),
    manager: hasPermission("pos.discount_manager"),
    supervisor: hasPermission("pos.discount_supervisor"),
    cashier: hasPermission("pos.discount_cashier"),
  });
  const canPriceOverride =
    hasPermission("pos.discount_manager") ||
    hasPermission("pos.discount_owner") ||
    hasPermission("pos.discount_special");
  const canRequestApproval = hasPermission("approvals.act");
  const actorRoles = sessionActorRolesForDiscountWorkflow({
    special: hasPermission("pos.discount_special"),
    owner: hasPermission("pos.discount_owner"),
    manager: hasPermission("pos.discount_manager"),
    supervisor: hasPermission("pos.discount_supervisor"),
    cashier: hasPermission("pos.discount_cashier"),
  });

  const policyRows = useMemo(
    () => buildDiscountPolicyRows({ actingRole, canPriceOverride }),
    [actingRole, canPriceOverride],
  );

  const [approvals, setApprovals] = useState<DiscountApprovalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [decideBusyId, setDecideBusyId] = useState<string | null>(null);

  const [scope, setScope] = useState<"invoice" | "line">("invoice");
  const [rawValue, setRawValue] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [reason, setReason] = useState("");

  const policyCheck = useMemo(() => {
    const base = Number(baseAmount);
    const parsed = parseDiscountValueInput(rawValue);
    if (!(base > 0) || parsed.value <= 0) {
      return { result: null as ReturnType<typeof evaluateDiscountAgainstPolicy> | null, error: null as string | null };
    }
    try {
      return {
        result: evaluateDiscountAgainstPolicy({
          base,
          mode: parsed.mode,
          value: parsed.value,
          actingRole,
        }),
        error: null as string | null,
      };
    } catch (err) {
      return {
        result: null as ReturnType<typeof evaluateDiscountAgainstPolicy> | null,
        error: err instanceof Error ? err.message : "Invalid discount",
      };
    }
  }, [baseAmount, rawValue, actingRole]);
  const checked = policyCheck.result;
  const policyError = policyCheck.error;

  const loadApprovals = useCallback(async () => {
    if (!canRequestApproval) {
      setApprovals([]);
      return;
    }
    setLoading(true);
    try {
      const res = await adminApi.listApprovals();
      setApprovals(
        (res.items ?? [])
          .map((row) => parseDiscountApproval(row))
          .filter((row): row is DiscountApprovalRow => row != null),
      );
    } catch (err) {
      setApprovals([]);
      toast.push({
        title: "Could not load discount approvals",
        description: err instanceof Error ? err.message : "Requires approvals.act",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }, [canRequestApproval]);

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals]);

  const pendingCount = approvals.filter((row) => row.status === "pending").length;

  async function requestApproval() {
    if (!canRequestApproval) {
      toast.push({
        title: "Cannot request approval",
        description: "Requires approvals.act. This is the real Approval Workflow, not a cashier override.",
        tone: "danger",
      });
      return;
    }
    if (!checked || !reason.trim()) {
      toast.push({
        title: "Discount and reason required",
        tone: "danger",
      });
      return;
    }
    if (!checked.decision.needsApproval) {
      toast.push({
        title: "Approval is not required",
        description: "This discount is within your permission cap. Apply it on New Sale.",
        tone: "info",
      });
      return;
    }
    setRequestBusy(true);
    try {
      const parsed = parseDiscountValueInput(rawValue);
      await adminApi.createApproval(
        buildDiscountApprovalCreateBody({
          branchId: branchId ?? undefined,
          title: `${scope === "invoice" ? "Invoice" : "Line"} discount ${checked.decision.percent}% requires ${checked.decision.requiredRole}`,
          amount: checked.applied.amount,
          remarks: reason.trim(),
          requesterRole: actingRole,
          payload: {
            scope,
            mode: parsed.mode,
            value: parsed.value,
            base: Number(baseAmount),
            percent: checked.decision.percent,
            requiredRole: checked.decision.requiredRole,
            actingRole,
            maxAllowed: checked.decision.maxAllowed,
          },
        }),
      );
      setReason("");
      toast.push({
        title: "Approval requested",
        description: "An approved request does not raise the cashier cap. A user with the required discount permission must apply it on New Sale. Sale posting still uses session permissions.",
        tone: "success",
      });
      await loadApprovals();
    } catch (err) {
      toast.push({
        title: "Request failed",
        description: err instanceof Error ? err.message : "Could not create approval",
        tone: "danger",
      });
    } finally {
      setRequestBusy(false);
    }
  }

  async function decide(id: string, decision: "approve" | "reject") {
    const row = approvals.find((item) => item.id === id);
    if (!row || !canDecideDiscountApproval(row, actorRoles)) {
      toast.push({
        title: "Cannot decide this request",
        description: `Current step requires ${row?.requiredRole ?? "a higher role"}. Roles are taken from your discount permissions — there is no self-approve override.`,
        tone: "danger",
      });
      return;
    }
    setDecideBusyId(id);
    try {
      await adminApi.decideApproval(id, {
        decision,
        actorRoles,
        remarks: `${decision} from POS Discounts`,
      });
      toast.push({
        title: decision === "approve" ? "Approved" : "Rejected",
        description:
          decision === "approve"
            ? "The request is recorded. Apply the discount on New Sale while signed in with the required permission. Caps are still enforced on sale post."
            : undefined,
        tone: "success",
      });
      await loadApprovals();
    } catch (err) {
      toast.push({
        title: "Decision failed",
        description: err instanceof Error ? err.message : "Could not update approval",
        tone: "danger",
      });
    } finally {
      setDecideBusyId(null);
    }
  }

  return (
    <div className="pos-ops-workspace space-y-3">
      <POSBreadcrumb
        items={[
          { label: "Home", to: "/" },
          { label: "Reports", to: "/pos/reports" },
          { label: "Discounts" },
        ]}
      />
      <POSPageHeader
        title="Discounts"
        subtitle="Live POS discount policy. Caps come from discount-policy and applyDiscount. The UI does not compute a sale grand total. Over-cap discounts require the real Approval Workflow — cashiers cannot self-override."
        actions={
          <POSButton variant="secondary" size="sm" onClick={() => void loadApprovals()} disabled={loading}>
            Refresh
          </POSButton>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <POSStatCard label="Your role" value={actingRole} hint="From pos.discount_* permissions" />
        <POSStatCard
          label="Maximum allowed"
          value={formatDiscountCap(maxDiscountPercentForRole(actingRole))}
          hint="Inclusive upper bound"
        />
        <POSStatCard
          label="Price Override"
          value={canPriceOverride ? "Allowed" : "Blocked"}
          tone={canPriceOverride ? "success" : "danger"}
          hint="Manager / owner / special only"
        />
        <POSStatCard label="Pending approvals" value={String(pendingCount)} tone={pendingCount ? "warning" : "neutral"} />
      </div>

      <POSCard>
        <POSSection
          title="Maximum discount policy"
          description={`Inclusive ladder: cashier 5% · supervisor 10% · manager 20% · owner 50% · special unlimited. Sale post overwrites approverRole from session permissions. Workflow: ${APPROVAL_CHAINS.discount.join(" → ")}.`}
        >
          <POSTable className="pos-register-table">
            <POSTableHead>
              <tr>
                {DISCOUNT_TABLE_COLUMNS.map((col) => (
                  <POSTh key={col}>{col}</POSTh>
                ))}
              </tr>
            </POSTableHead>
            <POSTableBody>
              {policyRows.map((row) => (
                <tr key={row.id}>
                  <POSTd className="font-medium">{row.discountType}</POSTd>
                  <POSTd>{row.value}</POSTd>
                  <POSTd>{row.maximumAllowed}</POSTd>
                  <POSTd>{row.approvalRequired}</POSTd>
                  <POSTd>
                    <POSBadge tone={row.statusTone}>{row.status}</POSBadge>
                  </POSTd>
                </tr>
              ))}
            </POSTableBody>
          </POSTable>
        </POSSection>
      </POSCard>

      <div className="pos-split-register">
        <POSCard>
          <POSSection
            title="Policy check"
            description="Uses applyDiscount and evaluateDiscountApproval only. This is not a cart grand total."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <POSSelect
                label="Discount Type"
                value={scope}
                onChange={(e) => setScope(e.target.value === "line" ? "line" : "invoice")}
                options={[
                  { value: "invoice", label: "Invoice discount" },
                  { value: "line", label: "Line discount" },
                ]}
              />
              <POSInput
                label="Value"
                value={rawValue}
                onChange={(e) => setRawValue(e.target.value)}
                placeholder="10 or 10%"
              />
              <POSInput
                label="Base amount"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value)}
                placeholder="Invoice or line base"
              />
              <POSInput
                label="Reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Required to request approval"
              />
            </div>
            {policyError ? <p className="mt-2 text-sm text-[var(--pos-danger)]">{policyError}</p> : null}
            {checked ? (
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-[var(--pos-muted)]">Discount amount</dt>
                  <dd className="font-semibold tabular-nums">{checked.applied.amount.toFixed(2)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--pos-muted)]">Percent of base</dt>
                  <dd className="font-semibold tabular-nums">{checked.decision.percent}%</dd>
                </div>
                <div>
                  <dt className="text-[var(--pos-muted)]">Maximum Allowed</dt>
                  <dd className="font-semibold">{formatDiscountCap(checked.decision.maxAllowed)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--pos-muted)]">Approval Required</dt>
                  <dd className="font-semibold">
                    {checked.decision.needsApproval ? `Yes (${checked.decision.requiredRole})` : "No"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-xs text-[var(--pos-muted)]">Enter a base and a discount value to check the live policy.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <POSButton
                onClick={() => void requestApproval()}
                disabled={requestBusy || !checked?.decision.needsApproval || !reason.trim()}
              >
                Request approval
              </POSButton>
              {!canRequestApproval ? (
                <p className="self-center text-xs text-[var(--pos-danger)]">
                  Requesting a discount approval requires approvals.act.
                </p>
              ) : null}
            </div>
          </POSSection>
        </POSCard>

        <POSCard>
          <POSSection
            title="Approval workflow"
            description="Real admin approval_requests with workflow type discount. Approved requests do not silently raise caps."
          >
            <POSStepper steps={DISCOUNT_WORKFLOW_STEPS} activeId="manager" className="mb-3" />
            {loading && approvals.length === 0 ? (
              <POSLoadingState label="Loading discount approvals…" rows={4} />
            ) : approvals.length === 0 ? (
              <POSEmptyState
                title="No discount approvals"
                description={
                  canRequestApproval
                    ? "Pending, approved, and rejected discount requests from Approval Workflow appear here."
                    : "Sign in with approvals.act to load the real discount approval inbox."
                }
              />
            ) : (
              <ul className="space-y-2">
                {approvals.map((row) => {
                  const canDecide = canDecideDiscountApproval(row, actorRoles);
                  return (
                    <li key={row.id} className="rounded-[var(--pos-radius)] border border-[var(--pos-border)] p-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{row.title}</p>
                          <p className="text-xs text-[var(--pos-muted)]">
                            {row.amount != null ? `Amount ${row.amount.toFixed(2)} · ` : ""}
                            Step {row.requiredRole}
                            {row.remarks ? ` · ${row.remarks}` : ""}
                          </p>
                        </div>
                        <POSBadge tone={approvalStatusTone(row.status)}>{row.status}</POSBadge>
                      </div>
                      {row.status === "pending" ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <POSButton
                            size="sm"
                            disabled={!canDecide || decideBusyId === row.id}
                            onClick={() => void decide(row.id, "approve")}
                          >
                            Approve
                          </POSButton>
                          <POSButton
                            size="sm"
                            variant="danger"
                            disabled={!canDecide || decideBusyId === row.id}
                            onClick={() => void decide(row.id, "reject")}
                          >
                            Reject
                          </POSButton>
                          {!canDecide ? (
                            <span className="self-center text-[11px] text-[var(--pos-muted)]">
                              Waiting on {row.requiredRole}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </POSSection>
        </POSCard>
      </div>
    </div>
  );
}
