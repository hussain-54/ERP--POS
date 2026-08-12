import { useEffect, useMemo, useState } from "react";
import type { Sale } from "@electronic-erp/contracts";
import { Button, Card, Input, useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { posApi } from "./pos-api";
import { ReceiptPreview, type InvoicePreview } from "./components/ReceiptPreview";

export function InvoicesPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [items, setItems] = useState<Sale[]>([]);
  const [invoice, setInvoice] = useState<InvoicePreview | null>(null);
  const [format, setFormat] = useState<"80mm" | "58mm" | "a4">("80mm");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const res = await posApi.listSales(branchId ?? undefined);
      setItems(res.items);
    } catch (err) {
      toast.push({
        title: "Load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (s) =>
        s.invoiceNumber.toLowerCase().includes(needle) ||
        s.id.toLowerCase().includes(needle) ||
        String(s.status).includes(needle),
    );
  }, [items, q]);

  async function openInvoice(id: string) {
    try {
      const inv = (await posApi.getInvoice(id)) as InvoicePreview;
      setInvoice(inv);
    } catch (err) {
      toast.push({
        title: "Invoice load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="text-sm text-[var(--erp-muted)]">Sales history, reprint, and receipt layouts</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void reload()} disabled={loading}>
          Refresh
        </Button>
      </div>

      <Card>
        <Input
          label="Search invoice #"
          placeholder="Invoice number or id…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {loading ? (
          <div className="mt-3 rounded-lg border border-dashed border-[var(--erp-border)] px-3 py-8 text-center text-sm text-[var(--erp-muted)]">
            Loading invoices…
          </div>
        ) : null}
        <ul className="mt-3 hidden divide-y text-sm md:block">
          {filtered.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              <div>
                <strong>{s.invoiceNumber}</strong>
                <div className="text-[var(--erp-muted)]">
                  {s.status} · {s.paymentStatus} · {Number(s.grandTotal).toFixed(2)} · paid{" "}
                  {Number(s.paidTotal).toFixed(2)} · due {Number(s.remainingTotal).toFixed(2)}
                </div>
                <div className="text-xs text-[var(--erp-muted)]">
                  {new Date(s.createdAt).toLocaleString()}
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => void openInvoice(s.id)}>
                View / print
              </Button>
            </li>
          ))}
          {!filtered.length ? (
            <li className="py-6 text-center text-[var(--erp-muted)]">No invoices found</li>
          ) : null}
        </ul>
        <div className="mt-3 space-y-2 md:hidden">
          {filtered.map((s) => (
            <div key={s.id} className="rounded-lg border border-[var(--erp-border)] p-3 text-sm">
              <div className="font-semibold">{s.invoiceNumber}</div>
              <div className="mt-1 text-xs text-[var(--erp-muted)]">
                {s.status} · {s.paymentStatus}
              </div>
              <div className="mt-1 text-xs text-[var(--erp-muted)]">
                Total {Number(s.grandTotal).toFixed(2)} · Paid {Number(s.paidTotal).toFixed(2)} · Due{" "}
                {Number(s.remainingTotal).toFixed(2)}
              </div>
              <div className="mt-1 text-xs text-[var(--erp-muted)]">
                {new Date(s.createdAt).toLocaleString()}
              </div>
              <div className="mt-2">
                <Button size="sm" variant="secondary" onClick={() => void openInvoice(s.id)}>
                  View / print
                </Button>
              </div>
            </div>
          ))}
          {!filtered.length ? (
            <div className="rounded-lg border border-dashed border-[var(--erp-border)] px-3 py-8 text-center text-sm text-[var(--erp-muted)]">
              No invoices found
            </div>
          ) : null}
        </div>
      </Card>

      {invoice ? (
        <ReceiptPreview
          invoice={invoice}
          format={format}
          onFormatChange={setFormat}
          onClose={() => setInvoice(null)}
        />
      ) : null}
    </div>
  );
}
