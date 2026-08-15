import { useState } from "react";
import { Button, Card, useToast } from "@electronic-erp/ui";
import { authStorage } from "@/features/auth/auth-service";
import { infrastructureApi } from "@/features/system/infrastructure-api";

const ENTITIES = ["products", "customers", "suppliers", "stock", "prices"] as const;

export function ImportExportPage() {
  const toast = useToast();
  const [entity, setEntity] = useState<(typeof ENTITIES)[number]>("products");
  const [csv, setCsv] = useState("");
  const [errors, setErrors] = useState<Array<{ row: number; field?: string; message: string }>>([]);

  async function downloadTemplate(e: string) {
    const res = await fetch(infrastructureApi.templateUrl(e), {
      headers: { Authorization: `Bearer ${authStorage.getToken() ?? ""}` },
    });
    const text = await res.text();
    const blob = new Blob([text], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${e}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    try {
      const result = await infrastructureApi.importEntity(
        entity,
        csv,
        entity === "prices" ? "bulk_price_import" : undefined,
      );
      setErrors(result.errors);
      toast.push({
        title: `Imported ${result.imported}, failed ${result.failed}`,
        tone: result.failed ? "danger" : "success",
      });
    } catch (err) {
      toast.push({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function exportProducts(format: "csv" | "excel" | "pdf") {
    const res = await fetch(infrastructureApi.exportProductsUrl(format), {
      headers: { Authorization: `Bearer ${authStorage.getToken() ?? ""}` },
    });
    const text = await res.text();
    const blob = new Blob([text], {
      type:
        format === "pdf"
          ? "application/pdf"
          : format === "excel"
            ? "application/vnd.ms-excel"
            : "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      format === "pdf"
        ? "products-export.pdf"
        : format === "excel"
          ? "products-export.xls"
          : "products-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Import / Export</h1>
      <p className="text-sm opacity-70">
        Excel/CSV import for products, customers, suppliers, stock, and prices. Export CSV, Excel
        (TSV), or PDF. Bulk price updates require pricing permissions and write audit rows.
      </p>

      <Card title="Templates + export">
        <div className="flex flex-wrap gap-2">
          {ENTITIES.map((e) => (
            <Button key={e} variant="secondary" type="button" onClick={() => void downloadTemplate(e)}>
              {e} template
            </Button>
          ))}
          <Button type="button" onClick={() => void exportProducts("csv")}>
            Export CSV
          </Button>
          <Button type="button" variant="secondary" onClick={() => void exportProducts("excel")}>
            Export Excel
          </Button>
          <Button type="button" variant="secondary" onClick={() => void exportProducts("pdf")}>
            Export PDF
          </Button>
        </div>
      </Card>

      <Card title="Import CSV / Excel-TSV">
        <label className="mb-2 flex flex-col gap-1 text-sm">
          <span className="opacity-70">Entity</span>
          <select
            className="rounded border border-[var(--erp-border)] bg-transparent px-2 py-2"
            value={entity}
            onChange={(e) => setEntity(e.target.value as (typeof ENTITIES)[number])}
          >
            {ENTITIES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <textarea
          className="min-h-48 w-full rounded-xl border border-[var(--erp-border)] p-3 font-mono text-xs"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder="Paste CSV (or Excel TSV) including header row"
        />
        <div className="mt-3">
          <Button type="button" onClick={() => void runImport()}>
            Import {entity}
          </Button>
        </div>
        {errors.length ? (
          <ul className="mt-4 space-y-1 text-sm text-[var(--erp-danger)]">
            {errors.map((err, idx) => (
              <li key={`${err.row}-${idx}`}>
                Row {err.row}
                {err.field ? ` · ${err.field}` : ""}: {err.message}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
