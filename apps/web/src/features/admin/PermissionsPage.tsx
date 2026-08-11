import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { adminApi } from "./admin-api";

export function PermissionsPage() {
  const toast = useToast();
  const [roles, setRoles] = useState<Array<Record<string, unknown>>>([]);
  const [perms, setPerms] = useState<Array<Record<string, unknown>>>([]);
  const [roleId, setRoleId] = useState("");
  const [rolePermKeys, setRolePermKeys] = useState<string[]>([]);
  const [userOverride, setUserOverride] = useState({
    userId: "",
    permissionKey: "",
    effect: "grant",
    branchId: "",
  });

  useEffect(() => {
    void Promise.all([adminApi.listRoles(), adminApi.listPermissions()])
      .then(([r, p]) => {
        setRoles(r.items);
        setPerms(p.items);
        if (r.items[0]) setRoleId(String(r.items[0].id));
      })
      .catch((err: unknown) =>
        toast.push({
          title: "Load failed",
          description: err instanceof Error ? err.message : "Error",
          tone: "danger",
        }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!roleId) return;
    void adminApi
      .listRolePermissions(roleId)
      .then((res) => {
        const keys = res.items.map((row) => {
          const p = row.permissions as { key?: string } | null;
          return String(p?.key ?? "");
        });
        setRolePermKeys(keys.filter(Boolean));
      })
      .catch(() => undefined);
  }, [roleId]);

  async function saveRolePerms(e: FormEvent) {
    e.preventDefault();
    try {
      await adminApi.setRolePermissions(roleId, rolePermKeys);
      toast.push({ title: "Role permissions saved", tone: "success" });
    } catch (err) {
      toast.push({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function onUserOverride(e: FormEvent) {
    e.preventDefault();
    try {
      await adminApi.setUserPermission({
        userId: userOverride.userId,
        permissionKey: userOverride.permissionKey,
        effect: userOverride.effect,
        branchId: userOverride.branchId || undefined,
      });
      toast.push({ title: "User permission saved", tone: "success" });
    } catch (err) {
      toast.push({
        title: "Override failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  function toggleKey(key: string) {
    setRolePermKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Permissions</h1>

      <Card title="Assign by role">
        <Form onSubmit={saveRolePerms}>
          <Select
            label="Role"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            options={roles.map((r) => ({
              value: String(r.id),
              label: `${String(r.code)} — ${String(r.name)}`,
            }))}
          />
          <div className="max-h-64 overflow-auto rounded border p-2 text-xs">
            {perms.slice(0, 200).map((p) => {
              const key = String(p.key);
              return (
                <label key={key} className="flex items-center gap-2 py-0.5">
                  <input
                    type="checkbox"
                    checked={rolePermKeys.includes(key)}
                    onChange={() => toggleKey(key)}
                  />
                  <span>{key}</span>
                </label>
              );
            })}
            <p className="mt-2 opacity-70">Showing first 200 permissions ({perms.length} total).</p>
          </div>
          <FormActions>
            <Button type="submit">Save role permissions</Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Assign by user (grant/deny, optional branch)">
        <Form onSubmit={onUserOverride}>
          <Input
            label="User ID"
            value={userOverride.userId}
            onChange={(e) => setUserOverride((p) => ({ ...p, userId: e.target.value }))}
          />
          <Input
            label="Permission key"
            value={userOverride.permissionKey}
            onChange={(e) => setUserOverride((p) => ({ ...p, permissionKey: e.target.value }))}
          />
          <Select
            label="Effect"
            value={userOverride.effect}
            onChange={(e) => setUserOverride((p) => ({ ...p, effect: e.target.value }))}
            options={[
              { value: "grant", label: "Grant" },
              { value: "deny", label: "Deny" },
            ]}
          />
          <Input
            label="Branch ID (optional)"
            value={userOverride.branchId}
            onChange={(e) => setUserOverride((p) => ({ ...p, branchId: e.target.value }))}
          />
          <FormActions>
            <Button type="submit">Save user permission</Button>
          </FormActions>
        </Form>
      </Card>
    </div>
  );
}
