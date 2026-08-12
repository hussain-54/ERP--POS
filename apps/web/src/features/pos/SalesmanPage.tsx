import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { enterpriseApi } from "@/features/enterprise/enterprise-api";

export type SalesmanOption = {
  id: string;
  name: string;
  commissionPercent: number;
  employeeId: string;
  code?: string;
  status?: string;
};

export function mapSalesmanEmployees(items: Array<Record<string, unknown>>): SalesmanOption[] {
  return items
    .filter((e) => Boolean(e.is_salesman) && e.user_id && e.is_active !== false)
    .map((e) => ({
      id: String(e.user_id),
      name: String(e.full_name ?? e.name ?? "Salesman"),
      commissionPercent: Number(e.commission_percent ?? 0),
      employeeId: String(e.id),
      code: e.code != null ? String(e.code) : undefined,
      status: e.is_active === false ? "inactive" : "active",
    }));
}

export function SalesmanPage() {
  const toast = useToast();
  const [employees, setEmployees] = useState<Array<Record<string, unknown>>>([]);
  const [references, setReferences] = useState<Array<Record<string, unknown>>>([]);
  const [commissions, setCommissions] = useState<Record<string, unknown> | null>(null);
  const [reports, setReports] = useState<Record<string, unknown> | null>(null);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    code: "",
    fullName: "",
    mobile: "",
    userId: "",
    commissionPercent: "2",
  });
  const [refForm, setRefForm] = useState({
    name: "",
    mobile: "",
    referenceCode: "",
    referenceType: "outside",
  });
  const [payForm, setPayForm] = useState({ commissionId: "", amount: "", paymentReference: "" });
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState("");
  const [editActive, setEditActive] = useState(true);

  async function reload() {
    const [e, c, r, rep] = await Promise.all([
      enterpriseApi.listEmployees(),
      enterpriseApi.commissions(),
      enterpriseApi.listReferences(),
      enterpriseApi.commissionReports(),
    ]);
    setEmployees(e.items);
    setCommissions(c);
    setReferences(r.items);
    setReports(rep);
  }

  useEffect(() => {
    void reload().catch((err) =>
      toast.push({
        title: "Salesman load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      }),
    );
  }, [toast]);

  const salesmen = useMemo(() => {
    const all = employees.filter((e) => Boolean(e.is_salesman));
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((e) => {
      const name = String(e.full_name ?? "").toLowerCase();
      const code = String(e.code ?? "").toLowerCase();
      return name.includes(needle) || code.includes(needle);
    });
  }, [employees, q]);

  async function addSalesman() {
    setBusy(true);
    try {
      await enterpriseApi.createEmployee({
        code: form.code,
        fullName: form.fullName,
        mobile: form.mobile || undefined,
        userId: form.userId || undefined,
        isSalesman: true,
        commissionPercent: Number(form.commissionPercent) || 0,
        isActive: true,
      });
      setForm({ code: "", fullName: "", mobile: "", userId: "", commissionPercent: "2" });
      toast.push({ title: "Salesman added", tone: "success" });
      await reload();
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

  async function saveProfile(id: string) {
    setBusy(true);
    try {
      await enterpriseApi.updateEmployee(id, {
        commissionPercent: Number(editRate) || 0,
        isActive: editActive,
        isSalesman: true,
      });
      setEditId(null);
      toast.push({ title: "Profile updated", tone: "success" });
      await reload();
    } catch (err) {
      toast.push({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  async function addReference() {
    setBusy(true);
    try {
      await enterpriseApi.createReference({
        name: refForm.name,
        mobile: refForm.mobile || undefined,
        referenceCode: refForm.referenceCode,
        referenceType: refForm.referenceType,
      });
      setRefForm({ name: "", mobile: "", referenceCode: "", referenceType: "outside" });
      toast.push({ title: "Reference added", tone: "success" });
      await reload();
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

  async function payCommission() {
    setBusy(true);
    try {
      await enterpriseApi.payCommission({
        commissionId: payForm.commissionId,
        amount: Number(payForm.amount),
        paymentReference: payForm.paymentReference || undefined,
      });
      setPayForm({ commissionId: "", amount: "", paymentReference: "" });
      toast.push({ title: "Commission payment recorded", tone: "success" });
      await reload();
    } catch (err) {
      toast.push({
        title: "Payment failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Salesman / References</h1>
          <p className="text-sm text-[var(--erp-muted)]">
            Manage salesman profiles, outside references, and commission due/paid reports. Commission
            accrues on finalized sales only.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void reload()}>
            Refresh
          </Button>
          <Link
            to="/hr"
            className="inline-flex h-9 items-center rounded-xl border border-[var(--erp-border)] px-3 text-sm"
          >
            HR
          </Link>
        </div>
      </div>

      <Card title="Add salesman">
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            void addSalesman();
          }}
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Employee ID / code"
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
            <Input
              label="Profile name"
              required
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            />
            <Input
              label="Mobile"
              value={form.mobile}
              onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
            />
            <Input
              label="Linked user id"
              value={form.userId}
              onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
              hint="Required for POS assignment"
            />
            <Input
              label="Commission rate %"
              value={form.commissionPercent}
              onChange={(e) => setForm((f) => ({ ...f, commissionPercent: e.target.value }))}
            />
          </div>
          <FormActions>
            <Button type="submit" disabled={busy}>
              Add salesman
            </Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Salesmen">
        <Input label="Search" placeholder="Name, code…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="mt-3 divide-y text-sm">
          {salesmen.map((e) => (
            <li key={String(e.id)} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong>{String(e.full_name)}</strong>
                  <div className="text-[var(--erp-muted)]">
                    ID {String(e.code)} · rate {Number(e.commission_percent ?? 0)}% ·{" "}
                    {e.is_active === false ? "inactive" : "active"}
                    {e.user_id ? ` · user ${String(e.user_id).slice(0, 8)}…` : " · no user link"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditId(String(e.id));
                    setEditRate(String(e.commission_percent ?? 0));
                    setEditActive(e.is_active !== false);
                  }}
                >
                  Edit profile
                </Button>
              </div>
              {editId === String(e.id) ? (
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    label="Commission rate"
                    value={editRate}
                    onChange={(ev) => setEditRate(ev.target.value)}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editActive}
                      onChange={(ev) => setEditActive(ev.target.checked)}
                    />
                    Active
                  </label>
                  <Button size="sm" onClick={() => void saveProfile(String(e.id))} disabled={busy}>
                    Save
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
          {!salesmen.length ? (
            <li className="py-6 text-center text-[var(--erp-muted)]">No salesman profiles yet.</li>
          ) : null}
        </ul>
      </Card>

      <Card title="Add reference">
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            void addReference();
          }}
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Name"
              required
              value={refForm.name}
              onChange={(e) => setRefForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              label="Mobile"
              value={refForm.mobile}
              onChange={(e) => setRefForm((f) => ({ ...f, mobile: e.target.value }))}
            />
            <Input
              label="Reference code"
              required
              value={refForm.referenceCode}
              onChange={(e) => setRefForm((f) => ({ ...f, referenceCode: e.target.value }))}
            />
            <Select
              label="Reference type"
              options={[
                { value: "outside", label: "Outside" },
                { value: "dealer", label: "Dealer" },
                { value: "influencer", label: "Influencer" },
                { value: "employee", label: "Employee" },
                { value: "other", label: "Other" },
              ]}
              value={refForm.referenceType}
              onChange={(e) => setRefForm((f) => ({ ...f, referenceType: e.target.value }))}
            />
          </div>
          <FormActions>
            <Button type="submit" disabled={busy}>
              Add reference
            </Button>
          </FormActions>
        </Form>
        <ul className="mt-3 divide-y text-sm">
          {references.map((r) => (
            <li key={String(r.id)} className="py-2">
              <strong>{String(r.name)}</strong>
              <div className="text-[var(--erp-muted)]">
                {String(r.reference_code)} · {String(r.reference_type)}
                {r.mobile ? ` · ${String(r.mobile)}` : ""}
                {r.is_active === false ? " · inactive" : ""}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Commission payment">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            label="Commission id"
            value={payForm.commissionId}
            onChange={(e) => setPayForm((f) => ({ ...f, commissionId: e.target.value }))}
          />
          <Input
            label="Amount"
            value={payForm.amount}
            onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
          />
          <Input
            label="Payment reference"
            value={payForm.paymentReference}
            onChange={(e) => setPayForm((f) => ({ ...f, paymentReference: e.target.value }))}
          />
        </div>
        <div className="mt-3">
          <Button onClick={() => void payCommission()} disabled={busy}>
            Record payment
          </Button>
        </div>
        <div className="mt-3 text-sm">
          Due: {Number(commissions?.totalDue ?? 0).toFixed(2)} · Paid:{" "}
          {Number(commissions?.totalPaid ?? 0).toFixed(2)} · Accrued:{" "}
          {Number(commissions?.totalCommission ?? 0).toFixed(2)}
        </div>
        <ul className="mt-2 max-h-48 divide-y overflow-auto text-xs">
          {((commissions?.items as Array<Record<string, unknown>>) ?? []).slice(0, 30).map((c) => (
            <li key={String(c.id)} className="py-1">
              {String(c.id).slice(0, 8)}… · {String(c.status)} · amt {Number(c.commission_amount).toFixed(2)} ·
              paid {Number(c.paid_amount ?? 0).toFixed(2)}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Reports">
        {reports ? (
          <div className="space-y-2 text-sm">
            <div>
              Commission due: <strong>{Number(reports.commissionDue ?? 0).toFixed(2)}</strong> · Paid:{" "}
              <strong>{Number(reports.commissionPaid ?? 0).toFixed(2)}</strong>
            </div>
            <div>
              <div className="font-medium">Top salesman</div>
              <pre className="max-h-40 overflow-auto text-xs">
                {JSON.stringify(reports.topSalesman ?? [], null, 2)}
              </pre>
            </div>
            <div>
              <div className="font-medium">Salesman sales</div>
              <pre className="max-h-40 overflow-auto text-xs">
                {JSON.stringify(reports.salesmanSales ?? [], null, 2)}
              </pre>
            </div>
            <div>
              <div className="font-medium">Reference sales</div>
              <pre className="max-h-40 overflow-auto text-xs">
                {JSON.stringify(reports.referenceSales ?? [], null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--erp-muted)]">No report data yet</p>
        )}
      </Card>
    </div>
  );
}
