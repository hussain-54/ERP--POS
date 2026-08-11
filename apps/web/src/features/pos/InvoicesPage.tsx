import { useEffect, useState } from "react";
import type { Sale } from "@electronic-erp/contracts";
import { Button, Card, useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { posApi } from "./pos-api";

export function InvoicesPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [items, setItems] = useState<Sale[]>([]);
  const [invoice, setInvoice] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void posApi
      .listSales(branchId ?? undefined)
      .then((res) => setItems(res.items))
      .catch((err: unknown) =>
        toast.push({
          title: "Load failed",
          description: err instanceof Error ? err.message : "Error",
          tone: "danger",
        }),
      );
  }, [branchId, toast]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Invoices</h1>
      <Card>
        <ul className="divide-y text-sm">
          {items.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              <div>
                <strong>{s.invoiceNumber}</strong>
                <div className="text-[var(--erp-muted)]">
                  {s.status} · {s.grandTotal} · paid {s.paidTotal} · due {s.remainingTotal}
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void posApi.getInvoice(s.id).then((inv) => setInvoice(inv as Record<string, unknown>))
                }
              >
                View / print
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      {invoice ? (
        <Card title="Invoice preview">
          <pre className="overflow-auto text-xs">{JSON.stringify(invoice, null, 2)}</pre>
        </Card>
      ) : null}
    </div>
  );
}
