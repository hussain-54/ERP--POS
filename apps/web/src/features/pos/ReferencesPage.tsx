import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { enterpriseApi } from "@/features/system/enterprise-api";
import { posApi } from "./pos-api";
import { formatMoney, formatSaleDate } from "./sales-workspace";
import {
  buildReferenceRegister,
  parseReferenceDirectory,
  REFERENCE_TABLE_COLUMNS,
  REFERENCE_TYPES,
  referenceStatusTone,
} from "./references-workspace";
import {
  POSBadge,
  POSButton,
  POSCard,
  POSInput,
  POSLoadingState,
  POSPageHeader,
  POSSearch,
  POSSelect,
  POSTable,
  POSTableBody,
  POSTableHead,
  POSTd,
  POSTh,
} from "./design-system";

export function ReferencesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { branchId, hasPermission } = useAuth();
  const canView =
    hasPermission("hr.view") ||
    hasPermission("salesman.manage") ||
    hasPermission("pos.sell") ||
    hasPermission("commissions.view");
  const canCreate =
    hasPermission("salesman.manage") || hasPermission("hr.manage") || hasPermission("pos.sell");
  const canAssign = hasPermission("pos.sell");

  const [rows, setRows] = useState(buildReferenceRegister([], []));
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    referenceCode: "",
    referenceType: "outside",
  });

  async function load() {
    if (!canView) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const [refs, sales] = await Promise.all([
        enterpriseApi.listReferences(),
        posApi
          .searchSalesManagement({
            branchId: branchId || undefined,
            limit: 100,
            offset: 0,
          })
          .catch(() => ({ items: [] as Array<Record<string, unknown>> })),
      ]);
      setRows(buildReferenceRegister(parseReferenceDirectory(refs.items), sales.items ?? []));
    } catch (err) {
      toast.push({
        title: "References load failed",
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
  }, [canView, branchId]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      `${row.referenceNumber} ${row.type} ${row.customer} ${row.invoice} ${row.salesman}`.toLowerCase().includes(
        needle,
      ),
    );
  }, [rows, query]);

  async function addReference() {
    if (!canCreate) return;
    setBusy(true);
    try {
      await enterpriseApi.createReference({
        name: form.name,
        mobile: form.mobile || undefined,
        referenceCode: form.referenceCode,
        referenceType: form.referenceType,
      });
      setForm({ name: "", mobile: "", referenceCode: "", referenceType: "outside" });
      toast.push({ title: "Reference added", tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Reference failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <POSPageHeader
        title="References"
        subtitle="Real sale_references plus posted sales that used them. New Sale still stores reference_id on the sale."
        actions={
          <POSButton variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            Refresh
          </POSButton>
        }
      />

      {canCreate ? (
        <POSCard title="Add reference">
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            <POSInput label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <POSInput
              label="Reference #"
              value={form.referenceCode}
              onChange={(e) => setForm((f) => ({ ...f, referenceCode: e.target.value }))}
            />
            <POSSelect
              label="Type"
              value={form.referenceType}
              onChange={(e) => setForm((f) => ({ ...f, referenceType: e.target.value }))}
              options={REFERENCE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
            <POSInput label="Phone" value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} />
          </div>
          <div className="mt-3">
            <POSButton
              onClick={() => void addReference()}
              disabled={busy || !form.name.trim() || !form.referenceCode.trim()}
            >
              Add reference
            </POSButton>
          </div>
        </POSCard>
      ) : null}

      <POSCard padding="none">
        <div className="p-3">
          <POSSearch value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Reference #, customer, invoice…" />
        </div>
        {loading && !rows.length ? (
          <POSLoadingState label="Loading references…" rows={6} className="p-3" />
        ) : (
          <POSTable>
            <POSTableHead>
              <tr>
                {REFERENCE_TABLE_COLUMNS.map((col) => (
                  <POSTh key={col}>{col}</POSTh>
                ))}
              </tr>
            </POSTableHead>
            <POSTableBody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <POSTd className="font-medium">{row.referenceNumber || "—"}</POSTd>
                  <POSTd className="capitalize">{row.type}</POSTd>
                  <POSTd>{row.customer}</POSTd>
                  <POSTd>{row.invoice}</POSTd>
                  <POSTd>{row.salesman}</POSTd>
                  <POSTd className="tabular-nums">{row.amount == null ? "—" : formatMoney(row.amount)}</POSTd>
                  <POSTd className="whitespace-nowrap">{formatSaleDate(row.date)}</POSTd>
                  <POSTd>
                    <POSBadge tone={referenceStatusTone(row.status)}>{row.status}</POSBadge>
                  </POSTd>
                  <POSTd>
                    <POSButton
                      size="sm"
                      variant="secondary"
                      disabled={!row.selectableOnSale || !canAssign}
                      onClick={() =>
                        navigate("/pos", {
                          state: { referenceId: row.referenceId },
                        })
                      }
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
