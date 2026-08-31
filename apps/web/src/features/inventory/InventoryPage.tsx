import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { StockBalance, StockMovement } from "@electronic-erp/contracts";
import { Badge, Breadcrumb, Button, Card, DataTable, FilterBar, Input, KpiCard, PageHeader, useToast } from "@electronic-erp/ui";
import { inventoryApi } from "./inventory-api";

export function InventoryPage() {
  const toast = useToast();
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [b, m] = await Promise.all([
        inventoryApi.listBalances(warehouseId ? { warehouseId } : {}),
        inventoryApi.listMovements(warehouseId ? { warehouseId } : {}),
      ]);
      setBalances(b.items);
      setMovements(m.items);
    } catch (err) {
      toast.push({
        title: "Failed to load inventory",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totalAvailable = balances.reduce((acc, b) => acc + Number(b.qtyAvailable || 0), 0);
  const totalReserved = balances.reduce((acc, b) => acc + Number(b.qtyReserved || 0), 0);
  const totalDamaged = balances.reduce((acc, b) => acc + Number(b.qtyDamaged || 0), 0);
  const totalInTransit = balances.reduce((acc, b) => acc + Number(b.qtyInTransit || 0), 0);

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Home", href: "/command-center" },
          { label: "Inventory & Warehouses", href: "/inventory" },
          { label: "Live Stock Balances" },
        ]}
      />

      <PageHeader
        moduleNumber="10"
        title="Live Inventory & Stock Balances"
        description="Double-entry ledger-backed inventory tracking: Available, Reserved, Damaged, and In-Transit quantities across all branches & warehouses."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition" to="/warehouses">
              <i className="fa-solid fa-warehouse text-slate-400" />
              <span>Warehouses</span>
            </Link>
            <Link className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition" to="/stock-transfers">
              <i className="fa-solid fa-truck-ramp-box text-slate-400" />
              <span>Transfers</span>
            </Link>
            <Link className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition" to="/batches-serials">
              <i className="fa-solid fa-barcode text-slate-400" />
              <span>Batches / Serials</span>
            </Link>
            <Link className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition" to="/stock-operations">
              <i className="fa-solid fa-plus" />
              <span>Post Stock Movement</span>
            </Link>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total Available Units"
          value={totalAvailable.toLocaleString()}
          tone="brand"
          icon={<i className="fa-solid fa-boxes-stacked" />}
        />
        <KpiCard
          label="Reserved for Orders"
          value={totalReserved.toLocaleString()}
          tone={totalReserved > 0 ? "warning" : "neutral"}
          icon={<i className="fa-solid fa-clock" />}
        />
        <KpiCard
          label="Damaged / Quarantine"
          value={totalDamaged.toLocaleString()}
          tone={totalDamaged > 0 ? "danger" : "neutral"}
          icon={<i className="fa-solid fa-triangle-exclamation" />}
        />
        <KpiCard
          label="In-Transit Transfers"
          value={totalInTransit.toLocaleString()}
          tone="purple"
          icon={<i className="fa-solid fa-truck-arrow-right" />}
        />
      </div>

      {/* Balances Data Table */}
      <Card title="Product Stock Balances" description="Live per-warehouse breakdown." divided>
        <FilterBar className="mb-3">
          <Input
            label="Filter Warehouse ID"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            placeholder="e.g. WH-MAIN or UUID"
          />
          <Button onClick={() => void load()} loading={loading}>
            Refresh Balances
          </Button>
        </FilterBar>

        <DataTable
          rows={balances}
          rowKey={(row) => row.id}
          searchable
          searchPlaceholder="Search products, SKUs, or warehouses…"
          pageSize={25}
          columnVisibility
          loading={loading}
          emptyTitle="No stock balances found"
          emptyDescription="Post an opening stock or purchase invoice movement to populate inventory."
          columns={[
            {
              key: "product",
              header: "Product / Item",
              sortValue: (row) => row.productId,
              filterValue: (row) => row.productId,
              cell: (row) => <span className="font-mono text-xs font-bold text-slate-900">{row.productId.slice(0, 12)}…</span>,
            },
            {
              key: "available",
              header: "Available",
              align: "right",
              sortValue: (row) => Number(row.qtyAvailable),
              cell: (row) => (
                <span className={`font-mono font-black ${Number(row.qtyAvailable) <= 0 ? "text-rose-600" : "text-emerald-700"}`}>
                  {row.qtyAvailable}
                </span>
              ),
            },
            {
              key: "reserved",
              header: "Reserved",
              align: "right",
              sortValue: (row) => Number(row.qtyReserved),
              cell: (row) => <span className="font-mono text-slate-600">{row.qtyReserved}</span>,
            },
            {
              key: "damaged",
              header: "Damaged",
              align: "right",
              sortValue: (row) => Number(row.qtyDamaged),
              cell: (row) => (
                <span className={`font-mono ${Number(row.qtyDamaged) > 0 ? "font-bold text-rose-600" : "text-slate-400"}`}>
                  {row.qtyDamaged}
                </span>
              ),
            },
            {
              key: "transit",
              header: "In Transit",
              align: "right",
              sortValue: (row) => Number(row.qtyInTransit),
              cell: (row) => <span className="font-mono text-purple-700">{row.qtyInTransit}</span>,
            },
            {
              key: "total",
              header: "Total Ledger Qty",
              align: "right",
              sortValue: (row) => Number(row.qtyTotal),
              cell: (row) => <span className="font-mono font-bold text-slate-900">{row.qtyTotal}</span>,
            },
            {
              key: "flags",
              header: "Health Status",
              cell: (row) => {
                const avail = Number(row.qtyAvailable || 0);
                const damaged = Number(row.qtyDamaged || 0);
                return (
                  <div className="flex gap-1">
                    {avail < 0 ? <Badge tone="danger" size="sm">Negative</Badge> : null}
                    {damaged > 0 ? <Badge tone="warning" size="sm">Damaged</Badge> : null}
                    {avail >= 0 && damaged === 0 ? (
                      <Badge tone="success" size="sm">Optimal</Badge>
                    ) : null}
                  </div>
                );
              },
            },
          ]}
        />
      </Card>

      {/* Recent Ledger Movements Table */}
      {movements.length ? (
        <Card title="Recent Stock Ledger Movements" description="Last audit movements posted to inventory." divided>
          <DataTable
            rows={movements.slice(0, 20)}
            rowKey={(row) => row.id}
            pageSize={10}
            columns={[
              {
                key: "type",
                header: "Movement Type",
                cell: (row) => <Badge tone="brand" size="sm">{row.movementType}</Badge>,
              },
              {
                key: "delta",
                header: "Quantity Delta",
                align: "right",
                cell: (row) => (
                  <span className={`font-mono font-black ${String(row.qtyDelta).startsWith("-") ? "text-rose-600" : "text-emerald-700"}`}>
                    {String(row.qtyDelta)}
                  </span>
                ),
              },
              {
                key: "source",
                header: "Source Ref",
                cell: (row) => <span className="font-mono text-xs text-slate-500">{row.sourceType} #{row.sourceId?.slice(0, 8)}</span>,
              },
              {
                key: "reason",
                header: "Reason / Note",
                cell: (row) => <span className="text-xs text-slate-600">{row.reason || "—"}</span>,
              },
            ]}
          />
        </Card>
      ) : null}
    </div>
  );
}
