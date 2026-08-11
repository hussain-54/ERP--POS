import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { inventoryApi } from "./inventory-api";
import { purchasesApi } from "@/features/purchases/purchases-api";
import { useAuth } from "@/features/auth/AuthContext";

export function WarehousesPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState({
    code: "",
    name: "",
    warehouseType: "branch",
    allowNegativeStock: false,
  });
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [locations, setLocations] = useState<{
    racks: Array<Record<string, unknown>>;
    shelves: Array<Record<string, unknown>>;
    bins: Array<Record<string, unknown>>;
  }>({ racks: [], shelves: [], bins: [] });
  const [locForm, setLocForm] = useState({
    rackCode: "",
    rackName: "",
    shelfCode: "",
    shelfName: "",
    rackId: "",
    binCode: "",
    binName: "",
    shelfId: "",
  });

  async function load() {
    const res = await inventoryApi.listWarehouses();
    setItems(res.items);
    if (!selectedWarehouseId && res.items[0]) {
      setSelectedWarehouseId(String(res.items[0].id));
    }
  }

  async function loadLocations(warehouseId: string) {
    if (!warehouseId) return;
    const res = await purchasesApi.listLocations(warehouseId);
    setLocations(res);
  }

  useEffect(() => {
    void load().catch((err: unknown) =>
      toast.push({
        title: "Load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      }),
    );
  }, [toast]);

  useEffect(() => {
    void loadLocations(selectedWarehouseId).catch(() => undefined);
  }, [selectedWarehouseId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!branchId) {
      toast.push({ title: "Select a branch first", tone: "danger" });
      return;
    }
    try {
      await inventoryApi.createWarehouse({
        branchId,
        code: form.code,
        name: form.name,
        warehouseType: form.warehouseType,
        isDefault: items.length === 0,
        allowNegativeStock: form.allowNegativeStock,
      });
      setForm({ code: "", name: "", warehouseType: "branch", allowNegativeStock: false });
      await load();
      toast.push({ title: "Warehouse created", tone: "success" });
    } catch (err) {
      toast.push({
        title: "Create failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Warehouses</h1>
      <p className="text-sm text-[var(--erp-muted)]">
        Types: main · branch · store · transit. Locations: Warehouse → Rack → Shelf → Bin
      </p>

      <Card>
        <Form onSubmit={onCreate}>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              label="Code"
              required
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
            />
            <Input
              label="Name"
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <Select
              label="Type"
              options={[
                { value: "main", label: "Main warehouse" },
                { value: "branch", label: "Branch warehouse" },
                { value: "store", label: "Store warehouse" },
                { value: "transit", label: "Transit warehouse" },
              ]}
              value={form.warehouseType}
              onChange={(e) => setForm((p) => ({ ...p, warehouseType: e.target.value }))}
            />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allowNegativeStock}
              onChange={(e) => setForm((p) => ({ ...p, allowNegativeStock: e.target.checked }))}
            />
            Allow negative stock (explicit override)
          </label>
          <FormActions>
            <Button type="submit">Create warehouse</Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Warehouse list">
        <ul className="space-y-2 text-sm">
          {items.map((w) => (
            <li key={String(w.id)} className="flex justify-between border-b py-2">
              <button
                type="button"
                className="text-left"
                onClick={() => setSelectedWarehouseId(String(w.id))}
              >
                <strong>{String(w.code)}</strong> · {String(w.name)}
              </button>
              <span className="text-[var(--erp-muted)]">{String(w.warehouse_type ?? "branch")}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Location hierarchy">
        <Select
          label="Warehouse"
          options={items.map((w) => ({ value: String(w.id), label: String(w.name) }))}
          value={selectedWarehouseId}
          onChange={(e) => setSelectedWarehouseId(e.target.value)}
        />
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Input
              label="Rack code"
              value={locForm.rackCode}
              onChange={(e) => setLocForm((p) => ({ ...p, rackCode: e.target.value }))}
            />
            <Input
              label="Rack name"
              value={locForm.rackName}
              onChange={(e) => setLocForm((p) => ({ ...p, rackName: e.target.value }))}
            />
            <Button
              size="sm"
              onClick={() =>
                void purchasesApi
                  .createRack({
                    warehouseId: selectedWarehouseId,
                    code: locForm.rackCode,
                    name: locForm.rackName,
                  })
                  .then(() => loadLocations(selectedWarehouseId))
              }
            >
              Add rack
            </Button>
            <ul className="text-xs">
              {locations.racks.map((r) => (
                <li key={String(r.id)}>
                  {String(r.code)} · {String(r.name)}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <Select
              label="Rack"
              options={locations.racks.map((r) => ({ value: String(r.id), label: String(r.code) }))}
              value={locForm.rackId}
              onChange={(e) => setLocForm((p) => ({ ...p, rackId: e.target.value }))}
            />
            <Input
              label="Shelf code"
              value={locForm.shelfCode}
              onChange={(e) => setLocForm((p) => ({ ...p, shelfCode: e.target.value }))}
            />
            <Input
              label="Shelf name"
              value={locForm.shelfName}
              onChange={(e) => setLocForm((p) => ({ ...p, shelfName: e.target.value }))}
            />
            <Button
              size="sm"
              onClick={() =>
                void purchasesApi
                  .createShelf({
                    rackId: locForm.rackId,
                    code: locForm.shelfCode,
                    name: locForm.shelfName,
                  })
                  .then(() => loadLocations(selectedWarehouseId))
              }
            >
              Add shelf
            </Button>
            <ul className="text-xs">
              {locations.shelves.map((s) => (
                <li key={String(s.id)}>
                  {String(s.code)} · {String(s.name)}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <Select
              label="Shelf"
              options={locations.shelves.map((s) => ({ value: String(s.id), label: String(s.code) }))}
              value={locForm.shelfId}
              onChange={(e) => setLocForm((p) => ({ ...p, shelfId: e.target.value }))}
            />
            <Input
              label="Bin code"
              value={locForm.binCode}
              onChange={(e) => setLocForm((p) => ({ ...p, binCode: e.target.value }))}
            />
            <Input
              label="Bin name"
              value={locForm.binName}
              onChange={(e) => setLocForm((p) => ({ ...p, binName: e.target.value }))}
            />
            <Button
              size="sm"
              onClick={() =>
                void purchasesApi
                  .createBin({
                    shelfId: locForm.shelfId,
                    code: locForm.binCode,
                    name: locForm.binName,
                  })
                  .then(() => loadLocations(selectedWarehouseId))
              }
            >
              Add bin
            </Button>
            <ul className="text-xs">
              {locations.bins.map((b) => (
                <li key={String(b.id)}>
                  {String(b.code)} · {String(b.name)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
