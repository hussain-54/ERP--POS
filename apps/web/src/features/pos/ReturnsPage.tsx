import { useEffect, useState, type FormEvent } from "react";
import type { Sale } from "@electronic-erp/contracts";
import { Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { inventoryApi } from "@/features/inventory/inventory-api";
import { posApi } from "./pos-api";
import type { InvoicePreview } from "./components/ReceiptPreview";

function uuid() {
  return crypto.randomUUID();
}

type ReturnLine = {
  key: string;
  productId?: string;
  unitId: string;
  name: string;
  qty: string;
  unitPrice: string;
  selected: boolean;
  exchangeProductId: string;
};

export function ReturnsPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [warehouseId, setWarehouseId] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [invoice, setInvoice] = useState<InvoicePreview | null>(null);
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [returnType, setReturnType] = useState("refund");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void inventoryApi.listWarehouses().then((r) => {
      if (r.items[0]) setWarehouseId(String(r.items[0].id));
    });
    void posApi
      .listSales(branchId ?? undefined)
      .then((r) => setSales(r.items))
      .catch(() => undefined);
  }, [branchId]);

  async function loadSale(saleId: string) {
    setSelectedSaleId(saleId);
    try {
      const inv = (await posApi.getInvoice(saleId)) as InvoicePreview;
      setInvoice(inv);
      setLines(
        inv.items.map((it, idx) => ({
          key: it.id ?? `${saleId}-${idx}`,
          productId: it.productId ?? undefined,
          unitId: it.unitId ?? "",
          name: it.name,
          qty: String(it.qty),
          unitPrice: String(it.rate),
          selected: true,
          exchangeProductId: "",
        })),
      );
    } catch (err) {
      toast.push({
        title: "Could not load invoice",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!branchId || !warehouseId || !selectedSaleId) {
      toast.push({ title: "Branch, warehouse and original sale required", tone: "danger" });
      return;
    }
    const selected = lines.filter((l) => l.selected && Number(l.qty) > 0);
    if (!selected.length) {
      toast.push({ title: "Select at least one return line", tone: "danger" });
      return;
    }
    if (selected.some((l) => !l.unitId)) {
      toast.push({
        title: "Missing unit on line",
        description: "Reload the invoice — unit IDs come from sale items",
        tone: "danger",
      });
      return;
    }
    setBusy(true);
    try {
      await posApi.postReturn({
        branchId,
        warehouseId,
        originalSaleId: selectedSaleId,
        returnType,
        reason,
        items: selected.map((l) => ({
          productId: l.productId || undefined,
          unitId: l.unitId,
          qty: l.qty,
          unitPrice: Number(l.unitPrice),
          exchangeProductId:
            returnType === "exchange" ? l.exchangeProductId || undefined : undefined,
        })),
        idempotencyKey: uuid(),
        operationId: uuid(),
      });
      toast.push({ title: "Return posted", tone: "success" });
      setReason("");
      setInvoice(null);
      setLines([]);
      setSelectedSaleId("");
    } catch (err) {
      toast.push({
        title: "Return failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  const matches = sales
    .filter((s) => {
      const needle = invoiceQuery.trim().toLowerCase();
      if (!needle) return true;
      return s.invoiceNumber.toLowerCase().includes(needle) || s.id.toLowerCase().includes(needle);
    })
    .slice(0, 20);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Returns / Exchange</h1>
        <p className="text-sm text-[var(--erp-muted)]">
          Look up an invoice, select lines, then post refund / credit / exchange through the POS return service.
        </p>
      </div>

      <Card title="1. Find original sale">
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Search invoice #"
            value={invoiceQuery}
            onChange={(e) => setInvoiceQuery(e.target.value)}
            placeholder="Type invoice number…"
          />
          <Input
            label="Warehouse"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          />
        </div>
        <ul className="mt-3 max-h-48 divide-y overflow-auto text-sm">
          {matches.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              <div>
                <strong>{s.invoiceNumber}</strong>
                <div className="text-[var(--erp-muted)]">
                  {Number(s.grandTotal).toFixed(2)} · {s.status}
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => void loadSale(s.id)}>
                Select
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      {invoice ? (
        <Card title={`2. Return lines · ${invoice.sale.invoiceNumber}`}>
          <Form onSubmit={onSubmit}>
            <div className="mb-3 grid gap-3 md:grid-cols-2">
              <Select
                label="Type"
                options={[
                  { value: "refund", label: "Refund" },
                  { value: "credit", label: "Customer credit" },
                  { value: "exchange", label: "Exchange" },
                ]}
                value={returnType}
                onChange={(e) => setReturnType(e.target.value)}
              />
              <Input
                label="Reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <ul className="space-y-2 text-sm">
              {lines.map((line) => (
                <li key={line.key} className="rounded-lg border px-3 py-2">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={line.selected}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x) =>
                            x.key === line.key ? { ...x, selected: e.target.checked } : x,
                          ),
                        )
                      }
                    />
                    <div className="flex-1">
                      <div className="font-medium">{line.name}</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                        <Input
                          label="Qty"
                          value={line.qty}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x) =>
                                x.key === line.key ? { ...x, qty: e.target.value } : x,
                              ),
                            )
                          }
                        />
                        <Input
                          label="Unit price"
                          value={line.unitPrice}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x) =>
                                x.key === line.key ? { ...x, unitPrice: e.target.value } : x,
                              ),
                            )
                          }
                        />
                        {returnType === "exchange" ? (
                          <Input
                            label="Exchange product ID"
                            value={line.exchangeProductId}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((x) =>
                                  x.key === line.key
                                    ? { ...x, exchangeProductId: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        ) : null}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
            <FormActions>
              <Button type="submit" disabled={busy}>
                {busy ? "Posting…" : "Post return"}
              </Button>
            </FormActions>
          </Form>
        </Card>
      ) : null}
    </div>
  );
}
