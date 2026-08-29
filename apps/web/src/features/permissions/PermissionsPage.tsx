import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  Form,
  FormActions,
  Input,
  PageHeader,
  Select,
  useToast,
} from "@electronic-erp/ui";
import { adminApi } from "@/features/users/admin-api";

export function PermissionsPage() {
  const toast = useToast();
  const [roles, setRoles] = useState<Array<Record<string, unknown>>>([]);
  const [perms, setPerms] = useState<Array<Record<string, unknown>>>([]);
  const [roleId, setRoleId] = useState("");
  const [rolePermKeys, setRolePermKeys] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([adminApi.listRoles(), adminApi.listPermissions()])
      .then(([r, p]) => {
        setRoles(r.items ?? []);
        setPerms(p.items ?? []);
        if (r.items?.[0]) setRoleId(String(r.items[0].id));
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
        const keys = (res.items ?? []).map((row) => {
          const p = row.permissions as { key?: string } | null;
          return String(p?.key ?? "");
        });
        setRolePermKeys(keys.filter(Boolean));
      })
      .catch(() => undefined);
  }, [roleId]);

  // Group permissions by module prefix (e.g. pos, products, inventory, customers, reports, settings)
  const groupedPerms = useMemo(() => {
    const map = new Map<string, Array<{ key: string; module: string; action: string; desc?: string }>>();

    for (const p of perms) {
      const key = String(p.key);
      const parts = key.split(".");
      const mod = String(p.module ?? parts[0] ?? "general");
      const action = String(p.action ?? parts.slice(1).join(".") ?? key);

      if (
        searchFilter &&
        !key.toLowerCase().includes(searchFilter.toLowerCase()) &&
        !mod.toLowerCase().includes(searchFilter.toLowerCase())
      ) {
        continue;
      }

      if (!map.has(mod)) map.set(mod, []);
      map.get(mod)!.push({
        key,
        module: mod,
        action,
        desc: p.description ? String(p.description) : undefined,
      });
    }

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [perms, searchFilter]);

  async function saveRolePerms(e: FormEvent) {
    e.preventDefault();
    if (!roleId) return;
    setSaving(true);
    try {
      await adminApi.setRolePermissions(roleId, rolePermKeys);
      toast.push({ title: "Role permissions saved", tone: "success" });
    } catch (err) {
      toast.push({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleKey(key: string) {
    setRolePermKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function toggleModule(modKeys: string[]) {
    const allSelected = modKeys.every((k) => rolePermKeys.includes(k));
    if (allSelected) {
      setRolePermKeys((prev) => prev.filter((k) => !modKeys.includes(k)));
    } else {
      setRolePermKeys((prev) => Array.from(new Set([...prev, ...modKeys])));
    }
  }

  function selectAll() {
    setRolePermKeys(perms.map((p) => String(p.key)));
  }

  function clearAll() {
    setRolePermKeys([]);
  }

  const selectedRole = roles.find((r) => String(r.id) === roleId);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/" },
          { label: "System Administration", href: "/settings" },
          { label: "Users & Roles", href: "/users" },
          { label: "Permissions" },
        ]}
      />

      <PageHeader
        title="Role Permission Matrix"
        description="Fine-grained granular access control mapping modules and actions to organizational roles."
      />

      <Card>
        <Form onSubmit={saveRolePerms} className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-80">
              <Select
                label="Selected Role"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                options={roles.map((r) => ({
                  value: String(r.id),
                  label: `${String(r.name ?? r.code)} (${r.is_system ? "System" : "Custom"})`,
                }))}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-6">
              <Button type="button" variant="secondary" size="sm" onClick={selectAll}>
                Select All ({perms.length})
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={clearAll}>
                Clear All
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? "Saving…" : `Save (${rolePermKeys.length} Granted)`}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Input
              placeholder="Search permissions by keyword (e.g. pos, sale, discount, reports)…"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full sm:max-w-md"
            />
            {selectedRole ? (
              <Badge tone="brand">
                Role: {String(selectedRole.code)}
              </Badge>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {groupedPerms.map(([mod, items]) => {
              const modKeys = items.map((i) => i.key);
              const grantedInMod = modKeys.filter((k) => rolePermKeys.includes(k)).length;
              const isAllChecked = grantedInMod === modKeys.length && modKeys.length > 0;

              return (
                <div
                  key={mod}
                  className="rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between border-b border-[var(--erp-border)] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold uppercase tracking-wider text-[var(--erp-ink)]">
                        {mod}
                      </span>
                      <span className="text-xs text-[var(--erp-muted)]">
                        ({grantedInMod}/{modKeys.length})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleModule(modKeys)}
                      className="text-xs font-medium text-[var(--erp-brand)] hover:underline"
                    >
                      {isAllChecked ? "Deselect" : "Select all"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {items.map((item) => {
                      const checked = rolePermKeys.includes(item.key);
                      return (
                        <label
                          key={item.key}
                          className="flex items-start gap-2.5 rounded p-1 text-xs cursor-pointer hover:bg-[var(--erp-bg)] transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleKey(item.key)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-[var(--erp-brand)] focus:ring-[var(--erp-ring)]"
                          />
                          <div className="flex-1">
                            <span
                              className={`font-mono font-medium ${
                                checked ? "text-[var(--erp-ink)]" : "text-[var(--erp-muted)]"
                              }`}
                            >
                              {item.key}
                            </span>
                            {item.desc ? (
                              <p className="text-[11px] text-[var(--erp-muted)] leading-tight">{item.desc}</p>
                            ) : null}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <FormActions>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving Changes…" : `Save ${rolePermKeys.length} Permissions`}
            </Button>
          </FormActions>
        </Form>
      </Card>
    </div>
  );
}
