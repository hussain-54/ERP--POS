import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Input, useToast } from "@electronic-erp/ui";
import { enterpriseApi } from "@/features/enterprise/enterprise-api";

export type SalesmanOption = {
  id: string;
  name: string;
  commissionPercent: number;
  employeeId: string;
  code?: string;
};

export function mapSalesmanEmployees(items: Array<Record<string, unknown>>): SalesmanOption[] {
  return items
    .filter((e) => Boolean(e.is_salesman) && e.user_id)
    .map((e) => ({
      id: String(e.user_id),
      name: String(e.full_name ?? e.name ?? "Salesman"),
      commissionPercent: Number(e.commission_percent ?? 0),
      employeeId: String(e.id),
      code: e.code != null ? String(e.code) : undefined,
    }));
}

export function SalesmanPage() {
  const toast = useToast();
  const [employees, setEmployees] = useState<Array<Record<string, unknown>>>([]);
  const [commissions, setCommissions] = useState<unknown>(null);
  const [q, setQ] = useState("");

  async function reload() {
    const [e, c] = await Promise.all([
      enterpriseApi.listEmployees(),
      enterpriseApi.commissions(),
    ]);
    setEmployees(e.items);
    setCommissions(c);
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
    const all = mapSalesmanEmployees(employees);
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        (s.code ?? "").toLowerCase().includes(needle) ||
        s.id.toLowerCase().includes(needle),
    );
  }, [employees, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Salesman / References</h1>
          <p className="text-sm text-[var(--erp-muted)]">
            Salesmen are HR employees flagged for commission. POS uses their linked user id on sales.
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
            Manage in HR
          </Link>
        </div>
      </div>

      <Card>
        <Input
          label="Search"
          placeholder="Name, code…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ul className="mt-3 divide-y text-sm">
          {salesmen.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              <div>
                <strong>{s.name}</strong>
                <div className="text-[var(--erp-muted)]">
                  {s.code ? `${s.code} · ` : ""}
                  Commission {s.commissionPercent}% · user {s.id.slice(0, 8)}…
                </div>
              </div>
            </li>
          ))}
          {!salesmen.length ? (
            <li className="py-6 text-center text-[var(--erp-muted)]">
              No salesman employees found. Create employees with “Salesman” in HR and link a user id.
            </li>
          ) : null}
        </ul>
      </Card>

      <Card title="Commission summary">
        <pre className="max-h-80 overflow-auto text-xs">
          {commissions ? JSON.stringify(commissions, null, 2) : "No commission data yet"}
        </pre>
      </Card>
    </div>
  );
}
