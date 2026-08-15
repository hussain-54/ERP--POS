import { useEffect, useState } from "react";
import { Button, Card, Input, useToast } from "@electronic-erp/ui";
import { enterpriseApi } from "@/features/system/enterprise-api";

const KINDS = [
  "cnic",
  "agreement",
  "supplier_document",
  "purchase_bill",
  "warranty_card",
  "tax_document",
  "quotation",
  "delivery_document",
  "repair_document",
  "other",
] as const;

const ENTITIES = [
  "customer",
  "supplier",
  "product",
  "sale",
  "purchase",
  "quotation",
  "delivery",
  "repair",
  "warranty",
  "tax",
  "employee",
  "other",
] as const;

export function DocumentsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [entityType, setEntityType] = useState<string>("customer");
  const [entityId, setEntityId] = useState("");
  const [kind, setKind] = useState<string>("cnic");
  const [title, setTitle] = useState("");
  const [fileName, setFileName] = useState("document.pdf");
  const [isSensitive, setIsSensitive] = useState(true);

  async function reload() {
    const qs = new URLSearchParams();
    if (entityType) qs.set("entityType", entityType);
    if (entityId) qs.set("entityId", entityId);
    const q = qs.toString() ? `?${qs}` : "";
    setItems((await enterpriseApi.listDocuments(q)).items);
  }

  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Document management</h1>
      <p className="text-sm opacity-70">
        Attach CNIC, agreements, supplier docs, purchase bills, warranty cards, tax docs, quotations,
        delivery/repair documents to customers, suppliers, products, and transactions. Sensitive docs
        require manage permission.
      </p>

      <Card title="Register attachment metadata">
        <div className="grid gap-2 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Entity type</span>
            <select
              className="rounded border border-[var(--erp-border)] bg-transparent px-2 py-2"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              {ENTITIES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Entity id"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
          />
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Document kind</span>
            <select
              className="rounded border border-[var(--erp-border)] bg-transparent px-2 py-2"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input label="File name" value={fileName} onChange={(e) => setFileName(e.target.value)} />
          <label className="mt-6 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isSensitive}
              onChange={(e) => setIsSensitive(e.target.checked)}
            />
            Sensitive (secure policy)
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            onClick={() =>
              void enterpriseApi
                .createDocument({
                  entityType,
                  entityId,
                  kind,
                  title: title || fileName,
                  fileName,
                  storagePath: `org/pending/${entityType}/${entityId}/${fileName}`,
                  mimeType: "application/pdf",
                  byteSize: 0,
                  isSensitive,
                })
                .then(() => reload())
                .then(() => toast.push({ title: "Document registered", tone: "success" }))
                .catch((err) =>
                  toast.push({
                    title: "Failed",
                    description: err instanceof Error ? err.message : "Error",
                    tone: "danger",
                  }),
                )
            }
          >
            Save document record
          </Button>
          <Button type="button" variant="secondary" onClick={() => void reload()}>
            Refresh
          </Button>
        </div>
      </Card>

      <Card title="Attachments">
        <ul className="space-y-2 text-sm">
          {items.map((d) => (
            <li key={String(d.id)} className="rounded border border-[var(--erp-border)] px-3 py-2">
              <div className="font-medium">
                {String(d.title)} {d.is_sensitive ? "· sensitive" : ""}
              </div>
              <div className="opacity-70">
                {String(d.entity_type)}/{String(d.entity_id).slice(0, 8)} · {String(d.kind)} ·{" "}
                {String(d.file_name)}
              </div>
              <div className="text-xs opacity-60">{String(d.storage_path)}</div>
            </li>
          ))}
          {!items.length && <li className="opacity-70">No documents yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
