import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { enterpriseApi } from "@/features/system/enterprise-api";
import { formatMoney } from "./sales-workspace";
import {
  parseSalesmanDirectory,
  salesTotalByUserId,
  salesmanStatusTone,
  SALESMEN_TABLE_COLUMNS,
} from "./salesman-workspace";
import {
  POSBadge,
  POSButton,
  POSCard,
  POSEmptyState,
  POSInput,
  POSLoadingState,
  POSPageHeader,
  POSSearch,
  POSStatCard,
  POSTable,
  POSTableBody,
  POSTableHead,
  POSTd,
  POSTh,
} from "./design-system";

export function SalesmenPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canView =
    hasPermission("hr.view") ||
    hasPermission("hr.manage") ||
    hasPermission("hr.payroll") ||
    hasPermission("salesman.manage") ||
    hasPermission("pos.sell");
  const canManage = hasPermission("hr.manage") || hasPermission("salesman.manage");
  const canAssign = hasPermission("pos.sell");

  const [rows, setRows] = useState(parseSalesmanDirectory([], new Map()));
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ code: "", fullName: "", mobile: "", commissionPercent: "2" });

  async function load() {
    if (!canView) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const [employees, reports] = await Promise.all([
        enterpriseApi.listEmployees(),
        enterpriseApi.commissionReports().catch(() => null),
      ]);
      setRows(parseSalesmanDirectory(employees.items, salesTotalByUserId(reports)));
    } catch (err) {
      toast.push({
        title: "Salesmen load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      `${row.name} ${row.code} ${row.phone}`.toLowerCase().includes(needle),
    );
  }, [rows, query]);

  async function addSalesman() {
    if (!canManage) return;
    setBusy(true);
    try {
      await enterpriseApi.createEmployee({
        code: form.code,
        fullName: form.fullName,
        mobile: form.mobile || undefined,
        isSalesman: true,
        commissionPercent: Number(form.commissionPercent) || 0,
        isActive: true,
      });
      setForm({ code: "", fullName: "", mobile: "", commissionPercent: "2" });
      toast.push({
        title: "Salesman added",
        description: "Link a user in HR before this profile can be selected on New Sale.",
        tone: "success",
      });
      await load();
    } catch (err) {
      toast.push({
        title: "Add failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  function selectForSale(row: (typeof rows)[number]) {
    if (!row.selectableOnSale || !row.userId) {
      toast.push({
        title: "Cannot select on New Sale",
        description: "This salesman needs an active linked user from HR.",
        tone: "danger",
      });
      return;
    }
    navigate("/pos", {
      state: { salesmanUserId: row.userId, commissionPercent: row.commissionPercent },
    });
  }

  return (
    <div className="space-y-3">
      <POSPageHeader
        title="Salesmen"
        subtitle="Roster from the Salesman module. Commission still accrues from pos-commission on posted sales. Select a linked salesman for New Sale."
        actions={
          <POSButton variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            Refresh
          </POSButton>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <POSStatCard label="Salesmen" value={String(rows.length)} />
        <POSStatCard label="Active" value={String(rows.filter((r) => r.status === "active").length)} tone="success" />
        <POSStatCard
          label="Selectable"
          value={String(rows.filter((r) => r.selectableOnSale).length)}
          hint="Active with linked user"
        />
        <POSStatCard
          label="Sales total"
          value={formatMoney(rows.reduce((sum, row) => sum + (row.salesTotal ?? 0), 0))}
        />
      </div>

      {!canView ? (
        <POSEmptyState title="Salesmen are not available" description="Requires hr.view, salesman.manage, or pos.sell." />
      ) : null}

      {canManage ? (
        <POSCard title="Add salesman">
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            <POSInput label="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            <POSInput
              label="Salesman"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            />
            <POSInput label="Phone" value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} />
            <POSInput
              label="Commission %"
              value={form.commissionPercent}
              onChange={(e) => setForm((f) => ({ ...f, commissionPercent: e.target.value }))}
            />
          </div>
          <div className="mt-3">
            <POSButton onClick={() => void addSalesman()} disabled={busy || !form.code.trim() || !form.fullName.trim()}>
              Add salesman
            </POSButton>
          </div>
        </POSCard>
      ) : null}

      <POSCard padding="none">
        <div className="p-3">
          <POSSearch value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, code, phone…" />
        </div>
        {loading && !rows.length ? (
          <POSLoadingState label="Loading salesmen…" rows={6} className="p-3" />
        ) : (
          <POSTable>
            <POSTableHead>
              <tr>
                {SALESMEN_TABLE_COLUMNS.map((col) => (
                  <POSTh key={col}>{col}</POSTh>
                ))}
                <POSTh>Action</POSTh>
              </tr>
            </POSTableHead>
            <POSTableBody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <POSTd className="font-medium">{row.name}</POSTd>
                  <POSTd>{row.code || "—"}</POSTd>
                  <POSTd>{row.phone || "—"}</POSTd>
                  <POSTd>{row.commissionPercent}%</POSTd>
                  <POSTd className="tabular-nums">{row.salesTotal == null ? "—" : formatMoney(row.salesTotal)}</POSTd>
                  <POSTd>
                    <POSBadge tone={salesmanStatusTone(row.status)}>{row.status}</POSBadge>
                  </POSTd>
                  <POSTd>
                    <POSButton
                      size="sm"
                      variant="secondary"
                      disabled={!row.selectableOnSale || !canAssign}
                      onClick={() => selectForSale(row)}
                    >
                      Select for sale
                    </POSButton>
                  </POSTd>
                </tr>
              ))}
            </POSTableBody>
          </POSTable>
        )}
      </POSCard>
    </div>
  );
}
