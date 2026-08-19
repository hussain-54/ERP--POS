import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { StockBalance, StockMovement } from "@electronic-erp/contracts";
import { Badge, Button, Card, DataTable, FilterBar, Input, useToast } from "@electronic-erp/ui";
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

      <Card>
        <FilterBar>
          <Input
            label="Filter warehouse ID"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          />
          <Button onClick={() => void load()}>Refresh</Button>
        </FilterBar>
      </Card>

      <Card title="Balances">
        <DataTable
          rows={balances}
          rowKey={(row) => row.id}
          searchable
          searchPlaceholder="Filter balances…"
          pageSize={25}
          columnVisibility
          emptyTitle="No balances yet"
          emptyDescription="Post an opening or purchase movement."
          columns={[
            {
              key: "product",
              header: "Product",
              sortValue: (row) => row.productId,
              filterValue: (row) => row.productId,
              cell: (row) => <span className="font-mono text-xs">{row.productId.slice(0, 8)}…</span>,
            },
            {
              key: "available",
              header: "Available",
              align: "right",
              sortValue: (row) => Number(row.qtyAvailable),
              cell: (row) => row.qtyAvailable,
            },
            {
              key: "reserved",
              header: "Reserved",
              align: "right",
              sortValue: (row) => Number(row.qtyReserved),
              cell: (row) => row.qtyReserved,
            },
            {
              key: "damaged",
              header: "Damaged",
              align: "right",
              sortValue: (row) => Number(row.qtyDamaged),
              cell: (row) => row.qtyDamaged,
            },
            {
              key: "transit",
              header: "In transit",
              align: "right",
              sortValue: (row) => Number(row.qtyInTransit),
              cell: (row) => row.qtyInTransit,
            },
            {
              key: "total",
              header: "Total",
              align: "right",
              sortValue: (row) => Number(row.qtyTotal),
              cell: (row) => row.qtyTotal,
            },
            {
              key: "flags",
              header: "Status",
              filterValue: (row) =>
                [row.isOutOfStock && "Out", row.isLowStock && "Low", row.isOverstock && "Over"]
                  .filter(Boolean)
                  .join(" "),
              cell: (row) => (
                <div className="flex flex-wrap gap-1">
                  {row.isOutOfStock ? <Badge tone="danger">Out</Badge> : null}
                  {row.isLowStock ? <Badge tone="warning">Low</Badge> : null}
                  {row.isOverstock ? <Badge>Over</Badge> : null}
                </div>
              ),
            },
          ]}
        />
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
