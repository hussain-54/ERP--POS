import { useEffect, useState } from "react";
import { Button, Card, Input, useToast } from "@electronic-erp/ui";
import { commerceApi } from "@/features/crm/commerce-api";

type CartLine = { productId: string; unitId: string; qty: string; name: string; price: number };

export function OnlineStorePage() {
  const toast = useToast();
  const [branchId, setBranchId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [storeName, setStoreName] = useState("Online Store");
  const [published, setPublished] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [catalog, setCatalog] = useState<Array<Record<string, unknown>>>([]);
  const [productId, setProductId] = useState("");
  const [detail, setDetail] = useState<unknown>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");

  useEffect(() => {
    void commerceApi
      .getStoreSettings()
      .then((r) => {
        if (!r.item) return;
        setBranchId(String(r.item.branch_id ?? ""));
        setWarehouseId(String(r.item.warehouse_id ?? ""));
        setStoreName(String(r.item.store_name ?? "Online Store"));
        setPublished(Boolean(r.item.is_published));
      })
      .catch(() => undefined);
  }, []);

  async function loadCatalog() {
    const qs = new URLSearchParams();
    if (categoryId) qs.set("categoryId", categoryId);
    if (brandId) qs.set("brandId", brandId);
    const q = qs.toString() ? `?${qs}` : "";
    setCatalog((await commerceApi.catalog(q)).items);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{storeName}</h1>
      <p className="text-sm opacity-70">
        Home → Category → Brand → Product → Variant → Cart → Checkout → ERP order. Uses the same
        product and stock system (no separate inventory).
      </p>

      <Card title="Store settings">
        <div className="grid gap-2 md:grid-cols-2">
          <Input label="Store name" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          <Input label="Branch id" value={branchId} onChange={(e) => setBranchId(e.target.value)} />
          <Input
            label="Warehouse id"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm mt-6">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />
            Published
          </label>
        </div>
        <Button
          className="mt-3"
          type="button"
          onClick={() =>
            void commerceApi
              .saveStoreSettings({
                branchId,
                warehouseId,
                storeName,
                isPublished: published,
              })
              .then(() => toast.push({ title: "Store settings saved", tone: "success" }))
              .catch((err) =>
                toast.push({
                  title: "Save failed",
                  description: err instanceof Error ? err.message : "Error",
                  tone: "danger",
                }),
              )
          }
        >
          Save settings
        </Button>
      </Card>

      <Card title="Browse (category / brand)">
        <div className="grid gap-2 md:grid-cols-3">
          <Input
            label="Category id"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          />
          <Input label="Brand id" value={brandId} onChange={(e) => setBrandId(e.target.value)} />
          <div className="flex items-end">
            <Button type="button" onClick={() => void loadCatalog()}>
              Load catalog
            </Button>
          </div>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          {catalog.map((p) => (
            <li key={String(p.id)} className="rounded border border-[var(--erp-border)] p-2">
              <div className="font-medium">{String(p.name)}</div>
              <div className="opacity-70">SKU {String(p.sku)}</div>
              <div className="tabular-nums">{String(p.retail_price)}</div>
              <Button
                className="mt-2"
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => {
                  setProductId(String(p.id));
                  void commerceApi.product(String(p.id)).then(setDetail);
                }}
              >
                Open product
              </Button>
              <Button
                className="mt-2 ml-2"
                size="sm"
                type="button"
                onClick={() =>
                  setCart((c) => [
                    ...c,
                    {
                      productId: String(p.id),
                      unitId: "",
                      qty: "1",
                      name: String(p.name),
                      price: Number(p.retail_price ?? 0),
                    },
                  ])
                }
              >
                Add to cart
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Product detail">
        <Input
          label="Product id"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        />
        <Button
          className="mt-2"
          type="button"
          variant="secondary"
          onClick={() => void commerceApi.product(productId).then(setDetail)}
        >
          Load images / video / specs / stock / warranty
        </Button>
        <pre className="mt-3 max-h-64 overflow-auto text-xs">
          {detail ? JSON.stringify(detail, null, 2) : "Select a product from the catalog."}
        </pre>
      </Card>

      <Card title="Cart → checkout → ERP order">
        <Input
          label="Customer id (optional, for loyalty/ledger)"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        />
        <ul className="mt-2 text-sm">
          {cart.map((l, i) => (
            <li key={`${l.productId}-${i}`}>
              {l.name} × {l.qty} @ {l.price}
            </li>
          ))}
          {!cart.length && <li className="opacity-70">Cart empty</li>}
        </ul>
        <Button
          className="mt-3"
          type="button"
          disabled={!cart.length}
          onClick={() =>
            void commerceApi
              .checkout({
                customerId: customerId || undefined,
                items: cart.map((l) => ({
                  productId: l.productId,
                  unitId: l.unitId || (detail as { product?: { base_unit_id?: string } })?.product?.base_unit_id,
                  qty: l.qty,
                })),
                idempotencyKey: crypto.randomUUID(),
              })
              .then((r) => {
                setCart([]);
                toast.push({
                  title: "Online order entered ERP",
                  description: JSON.stringify(r).slice(0, 180),
                  tone: "success",
                });
              })
              .catch((err) =>
                toast.push({
                  title: "Checkout failed",
                  description: err instanceof Error ? err.message : "Error",
                  tone: "danger",
                }),
              )
          }
        >
          Checkout (creates ERP sales order + stock reservation)
        </Button>
      </Card>
    </div>
  );
}
