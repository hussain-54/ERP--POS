import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Form, FormActions, Input, useToast } from "@electronic-erp/ui";
import { adminApi } from "@/features/users/admin-api";

export function BranchesPage() {
  const toast = useToast();
  const [branches, setBranches] = useState<Array<Record<string, unknown>>>([]);
  const [dashboard, setDashboard] = useState<Array<Record<string, unknown>> | null>(null);
  const [form, setForm] = useState({ code: "", name: "", address: "", isMain: false });
  const [membership, setMembership] = useState({ userId: "", branchId: "" });

  async function load() {
    const b = await adminApi.listBranches();
    setBranches(b.items);
    try {
      const g = await adminApi.groupDashboard();
      setDashboard(g.branches);
    } catch {
      setDashboard(null);
    }
  }

  useEffect(() => {
    void load().catch((err: unknown) =>
      toast.push({
        title: "Load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await adminApi.createBranch({
        code: form.code,
        name: form.name,
        address: form.address || undefined,
        isMain: form.isMain,
      });
      toast.push({ title: "Branch created", tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Create failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function onMembership(e: FormEvent) {
    e.preventDefault();
    try {
      await adminApi.setMembership({
        userId: membership.userId,
        branchId: membership.branchId,
        assign: true,
      });
      toast.push({ title: "Membership assigned", tone: "success" });
    } catch (err) {
      toast.push({
        title: "Membership failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Multi-branch</h1>

      <Card title="Branches">
        <div className="max-h-48 overflow-auto text-sm">
          {branches.map((b) => (
            <div key={String(b.id)} className="flex justify-between border-b py-1">
              <span>
                {String(b.code)} — {String(b.name)}
              </span>
              <span className="font-mono text-xs opacity-70">{String(b.id)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Create branch / main store">
        <Form onSubmit={onCreate}>
          <Input
            label="Code"
            value={form.code}
            onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
          />
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isMain}
              onChange={(e) => setForm((p) => ({ ...p, isMain: e.target.checked }))}
            />
            Main store
          </label>
          <FormActions>
            <Button type="submit">Create</Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Assign employee to branch">
        <Form onSubmit={onMembership}>
          <Input
            label="User ID"
            value={membership.userId}
            onChange={(e) => setMembership((p) => ({ ...p, userId: e.target.value }))}
          />
          <Input
            label="Branch ID"
            value={membership.branchId}
            onChange={(e) => setMembership((p) => ({ ...p, branchId: e.target.value }))}
          />
          <FormActions>
            <Button type="submit">Assign</Button>
          </FormActions>
        </Form>
      </Card>

      {dashboard && (
        <Card title="Owner group dashboard">
          <div className="max-h-64 overflow-auto text-sm">
            {dashboard.map((d) => (
              <div key={String(d.branchId)} className="border-b py-2">
                <div className="font-medium">
                  {String(d.name)} {d.isMain ? "(main)" : ""}
                </div>
                <div className="opacity-80">
                  sales {String(d.sales)} · purchases {String(d.purchases)} · expenses{" "}
                  {String(d.expenses)} · customers {String(d.customers)} · stock{" "}
                  {String(d.stockQty)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
