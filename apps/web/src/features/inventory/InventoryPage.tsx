import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { StockBalance, StockMovement } from "@electronic-erp/contracts";
import { Badge, Button, Card, Input, useToast } from "@electronic-erp/ui";
import { inventoryApi } from "./inventory-api";

export function InventoryPage() {
  const toast = useToast();
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [warehouseId, setWarehouseId] = useState("");

  async function load() {
    const [b, m] = await Promise.all([
      inventoryApi.listBalances(warehouseId ? { warehouseId } : {}),
      inventoryApi.listMovements(warehouseId ? { warehouseId } : {}),
    ]);
    setBalances(b.items);
    setMovements(m.items);
  }

  useEffect(() => {
    void load().catch((err: unknown) =>
      toast.push({
        title: "Failed to load inventory",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      }),
    );
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-sm text-[var(--erp-muted)]">
            Ledger-backed stock balances — available, reserved, damaged, in transit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex h-10 items-center rounded-xl border px-4 text-sm" to="/warehouses">
            Warehouses
          </Link>
          <Link className="inline-flex h-10 items-center rounded-xl border px-4 text-sm" to="/stock-transfers">
            Transfers
          </Link>
          <Link className="inline-flex h-10 items-center rounded-xl border px-4 text-sm" to="/batches-serials">
            Batch / Serial
          </Link>
        </div>
      </div>

      <Card className="flex flex-wrap items-end gap-3">
        <Input
          label="Filter warehouse ID"
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
        />
        <Button onClick={() => void load()}>Refresh</Button>
      </Card>

      <Card title="Balances">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--erp-muted)]">
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Available</th>
                <th className="py-2 pr-3">Reserved</th>
                <th className="py-2 pr-3">Damaged</th>
                <th className="py-2 pr-3">In transit</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2">Flags</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.id} className="border-t border-[var(--erp-border)]">
                  <td className="py-2 pr-3 font-mono text-xs">{b.productId.slice(0, 8)}…</td>
                  <td className="py-2 pr-3">{b.qtyAvailable}</td>
                  <td className="py-2 pr-3">{b.qtyReserved}</td>
                  <td className="py-2 pr-3">{b.qtyDamaged}</td>
                  <td className="py-2 pr-3">{b.qtyInTransit}</td>
                  <td className="py-2 pr-3">{b.qtyTotal}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {b.isOutOfStock ? <Badge tone="danger">Out</Badge> : null}
                      {b.isLowStock ? <Badge tone="warning">Low</Badge> : null}
                      {b.isOverstock ? <Badge>Over</Badge> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!balances.length ? (
                <tr>
                  <td className="py-4 text-[var(--erp-muted)]" colSpan={7}>
                    No balances yet. Post an opening or purchase movement.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Recent ledger movements">
        <ul className="space-y-2 text-sm">
          {movements.map((m) => (
            <li key={m.id} className="flex flex-wrap justify-between gap-2 border-b border-[var(--erp-border)] py-2">
              <span>
                <strong>{m.movementType}</strong> {m.qtyDelta} · before {m.qtyBefore} → after {m.qtyAfter}
              </span>
              <span className="text-[var(--erp-muted)]">{m.occurredAt}</span>
            </li>
          ))}
          {!movements.length ? <li className="text-[var(--erp-muted)]">No movements yet.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
