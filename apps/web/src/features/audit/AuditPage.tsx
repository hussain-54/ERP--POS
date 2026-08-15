import { useEffect, useState } from "react";
import { Card, useToast } from "@electronic-erp/ui";
import { adminApi } from "@/features/users/admin-api";

export function AuditPage() {
  const toast = useToast();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    void adminApi
      .listAudit(150)
      .then((res) => setItems(res.items))
      .catch((err: unknown) =>
        toast.push({
          title: "Load failed",
          description: err instanceof Error ? err.message : "Error",
          tone: "danger",
        }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Audit trail</h1>
      <p className="text-sm opacity-70">Append-only. Ordinary users cannot edit or delete entries.</p>
      <Card title="Recent events">
        <div className="max-h-[32rem] overflow-auto text-sm">
          {items.map((a) => (
            <div key={String(a.id)} className="border-b py-2">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{String(a.action)}</span>
                <span className="opacity-70">{String(a.created_at)}</span>
              </div>
              <div className="opacity-80">
                {String(a.entity_type)} · {String(a.entity_id ?? "—")} · actor{" "}
                {String(a.actor_user_id ?? "—")} · {String(a.actor_kind ?? "other")}
              </div>
              {a.before != null || a.after != null ? (
                <pre className="mt-1 overflow-auto text-xs opacity-70">
                  {JSON.stringify({ before: a.before, after: a.after }, null, 0)}
                </pre>
              ) : null}
            </div>
          ))}
          {!items.length && <p className="opacity-70">No audit events yet.</p>}
        </div>
      </Card>
    </div>
  );
}
