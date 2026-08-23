import { useCallback, useEffect, useState } from "react";
import type { ApprovalWorkflowType } from "@electronic-erp/domain";
import { useAuth } from "@/features/auth/AuthContext";
import { adminApi } from "@/features/users/admin-api";
import { useToast } from "@electronic-erp/ui";
import { PosSubPageShell } from "../PosSubPageShell";
import { money } from "../format";
import {
  APPROVAL_MODE_META,
  approvalActorRolesFromPermissions,
  canDecideApproval,
  filterApprovalsForMode,
  formatApprovalStatus,
  requiredApproverLabel,
  type PosApprovalMode,
} from "./approval-utils";

export function ApprovalsWorkspace({ mode }: { mode: PosApprovalMode }) {
  const meta = APPROVAL_MODE_META[mode];
  const { permissions, hasPermission } = useAuth();
  const { push } = useToast();

  const canView = hasPermission("approvals.view") || hasPermission("approvals.act");
  const canAct = hasPermission("approvals.act");
  const actorRoles = approvalActorRolesFromPermissions(permissions);

  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"pending" | "all">("pending");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await adminApi.listApprovals(statusFilter === "pending" ? "pending" : undefined);
      setItems(filterApprovalsForMode(res.items, mode));
    } catch (err) {
      push({
        title: "Load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
      setItems([]);
    } finally {
      setBusy(false);
    }
  }, [mode, statusFilter, push]);

  useEffect(() => {
    if (canView) void load();
  }, [load, canView]);

  async function decide(id: string, decision: "approve" | "reject", row: Record<string, unknown>) {
    if (!canAct) {
      push({ title: "Not permitted", description: "approvals.act required", tone: "danger" });
      return;
    }
    const workflow = String(row.workflow_type) as ApprovalWorkflowType;
    const step = Number(row.current_step ?? 0);
    if (!canDecideApproval({ workflow, currentStep: step, status: "pending", permissions })) {
      push({
        title: "Cannot act on this step",
        description: `Requires ${requiredApproverLabel(workflow, step)}. Your roles: ${actorRoles.join(", ") || "none"}`,
        tone: "danger",
      });
      return;
    }

    setBusy(true);
    try {
      await adminApi.decideApproval(id, {
        decision,
        actorRoles,
        remarks: `${decision} via POS approvals`,
      });
      push({ title: decision === "approve" ? "Approved" : "Rejected", tone: "success" });
      await load();
    } catch (err) {
      push({
        title: "Decision failed",
        description: err instanceof Error ? err.message : "Server rejected action",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!canView) {
    return (
      <PosSubPageShell moduleNumber="10" moduleLabel="Approvals" title={meta.title} description={meta.description}>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          You need approvals.view or approvals.act to open the inbox.
        </div>
      </PosSubPageShell>
    );
  }

  return (
    <PosSubPageShell moduleNumber="10" moduleLabel="Approvals" title={meta.title} description={meta.description}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "pending" | "all")}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold"
          >
            <option value="pending">Pending only</option>
            <option value="all">All statuses</option>
          </select>
          <button type="button" disabled={busy} onClick={() => void load()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold">
            Refresh
          </button>
          <p className="text-[10px] text-slate-500">
            Acting roles: {actorRoles.join(", ") || "none"} · Server validates on decide
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No approval requests in this view.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Requested by</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const id = String(row.id);
                  const workflow = String(row.workflow_type) as ApprovalWorkflowType;
                  const step = Number(row.current_step ?? 0);
                  const status = String(row.status ?? "");
                  const pending = status === "pending";
                  const canRow = pending && canDecideApproval({ workflow, currentStep: step, status, permissions });
                  return (
                    <tr key={id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold capitalize">{workflow}</td>
                      <td className="px-3 py-2">{String(row.requester_role ?? "—")}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {row.amount != null ? money(Number(row.amount)) : "—"}
                      </td>
                      <td className="max-w-[12rem] truncate px-3 py-2" title={String(row.remarks ?? row.title ?? "")}>
                        {String(row.remarks ?? row.title ?? "—")}
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {row.created_at ? new Date(String(row.created_at)).toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2 capitalize">{formatApprovalStatus(status)}</td>
                      <td className="px-3 py-2 text-right">
                        {pending && canAct ? (
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              disabled={busy || !canRow}
                              onClick={() => void decide(id, "approve", row)}
                              className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-40"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={busy || !canRow}
                              onClick={() => void decide(id, "reject", row)}
                              className="rounded-lg bg-red-600 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-40"
                            >
                              Reject
                            </button>
                          </div>
                        ) : pending && !canRow ? (
                          <span className="text-[10px] text-amber-700">Needs {requiredApproverLabel(workflow, step)}</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {mode === "void" || mode === "price-override" ? (
          <p className="text-[10px] text-slate-500">
            Dedicated void/override workflow types are not in the approval enum yet. Matching discount/return requests appear above.
          </p>
        ) : null}
      </div>
    </PosSubPageShell>
  );
}
