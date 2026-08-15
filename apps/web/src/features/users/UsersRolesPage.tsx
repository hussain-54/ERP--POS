import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { adminApi } from "./admin-api";

const ROLE_CODES = [
  "super_admin",
  "owner",
  "admin",
  "manager",
  "cashier",
  "salesman",
  "storekeeper",
  "warehouse_manager",
  "accountant",
  "delivery_boy",
  "technician",
  "marketing_manager",
];

export function UsersRolesPage() {
  const toast = useToast();
  const [roles, setRoles] = useState<Array<Record<string, unknown>>>([]);
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState({ userId: "", roleCode: "cashier", branchId: "" });

  async function load() {
    const [r, u] = await Promise.all([adminApi.listRoles(), adminApi.listUsers()]);
    setRoles(r.items);
    setUsers(u.items);
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

  async function seed() {
    try {
      await adminApi.seedRoles();
      toast.push({ title: "System roles seeded", tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Seed failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function onAssign(e: FormEvent) {
    e.preventDefault();
    try {
      await adminApi.assignRole({
        userId: form.userId,
        roleCode: form.roleCode,
        branchId: form.branchId || undefined,
      });
      toast.push({ title: "Role assigned", tone: "success" });
    } catch (err) {
      toast.push({
        title: "Assign failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users & Roles</h1>
        <Button type="button" onClick={() => void seed()}>
          Seed 12 system roles
        </Button>
      </div>

      <Card title="System roles">
        <div className="max-h-56 overflow-auto text-sm">
          {roles.map((r) => (
            <div key={String(r.id)} className="flex justify-between border-b py-1">
              <span>
                {String(r.code)} — {String(r.name)}
              </span>
              <span>{r.is_system ? "system" : "custom"}</span>
            </div>
          ))}
          {!roles.length && <p className="opacity-70">No roles — seed system roles.</p>}
        </div>
      </Card>

      <Card title="Assign role to user">
        <Form onSubmit={onAssign}>
          <Select
            label="User"
            value={form.userId}
            onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}
            options={users.map((u) => ({
              value: String(u.id),
              label: `${String(u.full_name)} (${String(u.email)})`,
            }))}
          />
          <Select
            label="Role"
            value={form.roleCode}
            onChange={(e) => setForm((p) => ({ ...p, roleCode: e.target.value }))}
            options={ROLE_CODES.map((c) => ({ value: c, label: c }))}
          />
          <Input
            label="Branch ID (optional — branch-scoped role)"
            value={form.branchId}
            onChange={(e) => setForm((p) => ({ ...p, branchId: e.target.value }))}
          />
          <FormActions>
            <Button type="submit">Assign</Button>
          </FormActions>
        </Form>
      </Card>
    </div>
  );
}
