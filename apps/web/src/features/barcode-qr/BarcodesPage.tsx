import { useEffect, useState } from "react";
import { Button, Card, Input, useToast } from "@electronic-erp/ui";
import { catalogApi } from "@/features/product-management/catalog-api";

export function BarcodesPage() {
  const toast = useToast();
  const [productId, setProductId] = useState("");
  const [bulkIds, setBulkIds] = useState("");
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);

  async function refresh(id?: string) {
    const res = await catalogApi.listBarcodes(id || undefined);
    setItems(res.items);
  }

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Barcode & QR</h1>
        <p className="text-sm text-[var(--erp-muted)]">
          Generate, bulk-create, and reprint codes. Hardware scanning comes later.
        </p>
      </div>

      <Card className="space-y-3">
        <Input label="Product ID" value={productId} onChange={(e) => setProductId(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() =>
              void catalogApi
                .generateBarcode(productId, "code128")
                .then(() => refresh(productId))
                .then(() => toast.push({ title: "Barcode generated", tone: "success" }))
                .catch((err: unknown) =>
                  toast.push({
                    title: "Generate failed",
                    description: err instanceof Error ? err.message : "Error",
                    tone: "danger",
                  }),
                )
            }
          >
            Generate barcode
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              void catalogApi
                .generateBarcode(productId, "sku")
                .then(() => refresh(productId))
                .then(() => toast.push({ title: "SKU barcode generated", tone: "success" }))
                .catch((err: unknown) =>
                  toast.push({
                    title: "Generate failed",
                    description: err instanceof Error ? err.message : "Error",
                    tone: "danger",
                  }),
                )
            }
          >
            SKU barcode
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              void catalogApi
                .generateQr(productId)
                .then((qr) =>
                  toast.push({
                    title: "QR created",
                    description: String((qr as { payload?: string }).payload ?? ""),
                    tone: "success",
                  }),
                )
                .catch((err: unknown) =>
                  toast.push({
                    title: "QR failed",
                    description: err instanceof Error ? err.message : "Error",
                    tone: "danger",
                  }),
                )
            }
          >
            Generate / reprint QR
          </Button>
          <Button variant="ghost" onClick={() => void refresh(productId || undefined)}>
            Refresh list
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <Input
          label="Bulk product IDs (comma-separated)"
          value={bulkIds}
          onChange={(e) => setBulkIds(e.target.value)}
        />
        <Button
          onClick={() => {
            const ids = bulkIds
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);
            void catalogApi
              .bulkGenerateBarcodes(ids)
              .then((res) => {
                toast.push({ title: `Generated ${res.items.length} barcodes`, tone: "success" });
                return refresh();
              })
              .catch((err: unknown) =>
                toast.push({
                  title: "Bulk generate failed",
                  description: err instanceof Error ? err.message : "Error",
                  tone: "danger",
                }),
              );
          }}
        >
          Bulk generate
        </Button>
      </Card>

      <Card>
        <ul className="space-y-2 text-sm">
          {items.map((row) => (
            <li key={String(row.id)} className="flex justify-between gap-3 border-b py-2">
              <span>
                {String(row.code)} <span className="text-[var(--erp-muted)]">({String(row.code_type)})</span>
              </span>
              <span className="text-[var(--erp-muted)]">{String(row.product_id)}</span>
            </li>
          ))}
          {!items.length ? <li className="text-[var(--erp-muted)]">No barcodes yet.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
