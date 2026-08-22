import { useEffect, useState, type FormEvent } from "react";
import {
  BarcodeHardwareService,
  buildBarcodeLabel,
  buildPaymentReceipt,
  buildSalesInvoice,
} from "@electronic-erp/hardware";
import { Badge, Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { deviceHardware } from "@/features/devices/hardware-service";
import { hardwareApi } from "./hardware-api";

const DOC_TYPES = [
  "sales_invoice",
  "purchase_invoice",
  "payment_receipt",
  "installment_receipt",
  "quotation",
  "delivery_challan",
  "warranty_card",
  "repair_job_card",
  "barcode_label",
  "stock_report",
];

export function PrintingPage() {
  const toast = useToast();
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([]);
  const [preview, setPreview] = useState("");
  const [localStatus, setLocalStatus] = useState("");
  const [form, setForm] = useState({
    documentType: "sales_invoice",
    title: "Sales Invoice",
    line: "Item A x1  100.00",
    barcode: "1234567890123",
    productName: "Sample Product",
  });

  const barcodeHw = new BarcodeHardwareService(deviceHardware);

  async function load() {
    try {
      const res = await hardwareApi.listPrintJobs();
      setJobs(res.items);
    } catch {
      setJobs([]);
    }
    setLocalStatus(
      deviceHardware
        .listStatuses()
        .map((s) => `${s.capability}:${s.status}`)
        .join(" · "),
    );
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onQueue(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await hardwareApi.print({
        documentType: form.documentType,
        title: form.title,
        lines: [form.line],
        barcodeValue: form.documentType === "barcode_label" ? form.barcode : undefined,
      });
      setPreview(String(res.preview ?? ""));
      toast.push({ title: "Print job queued", tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Queue failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function localPrint() {
    const doc =
      form.documentType === "barcode_label"
        ? buildBarcodeLabel({ productName: form.productName, barcode: form.barcode })
        : form.documentType === "payment_receipt"
          ? buildPaymentReceipt({ receiptNumber: "RCV-1", amount: 100 })
          : buildSalesInvoice({
              invoiceNumber: "INV-LOCAL",
              date: new Date().toISOString().slice(0, 10),
              lines: [{ name: form.line, qty: 1, amount: 100 }],
              grandTotal: 100,
            });
    const result = await deviceHardware.printDocument(doc);
    setPreview(`${doc.title}\n${result.ok ? "OK" : result.error ?? result.status}`);
    toast.push({
      title: result.ok ? "Printed locally" : "Print failed",
      description: result.status,
      tone: result.ok ? "success" : "danger",
    });
  }

  async function printLabel() {
    const r = await barcodeHw.printLabel({
      productName: form.productName,
      barcode: form.barcode,
      price: 99,
    });
    toast.push({
      title: r.ok ? "Label printed" : "Label failed",
      description: r.error ?? r.status,
      tone: r.ok ? "success" : "danger",
    });
  }

  async function reprint() {
    const r = await barcodeHw.reprintLast();
    toast.push({
      title: r.ok ? "Reprinted" : "Reprint failed",
      description: r.error ?? r.status,
      tone: r.ok ? "success" : "danger",
    });
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Printing</h1>
      <p className="text-sm opacity-70">Local: {localStatus || "loading…"}</p>

      <Card title="Queue document print">
        <Form onSubmit={onQueue}>
          <Select
            label="Document"
            value={form.documentType}
            onChange={(e) => setForm((p) => ({ ...p, documentType: e.target.value }))}
            options={DOC_TYPES.map((d) => ({ value: d, label: d }))}
          />
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
          <Input
            label="Line"
            value={form.line}
            onChange={(e) => setForm((p) => ({ ...p, line: e.target.value }))}
          />
          <Input
            label="Product name (labels)"
            value={form.productName}
            onChange={(e) => setForm((p) => ({ ...p, productName: e.target.value }))}
          />
          <Input
            label="Barcode (labels)"
            value={form.barcode}
            onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))}
          />
          <FormActions>
            <Button type="submit">Queue to server</Button>
            <Button type="button" onClick={() => void localPrint()}>
              Print locally
            </Button>
            <Button type="button" onClick={() => void printLabel()}>
              Label
            </Button>
            <Button type="button" onClick={() => void reprint()}>
              Reprint last label
            </Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Preview / last result">
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs">{preview || "—"}</pre>
      </Card>

      <Card title="Recent jobs">
        <div className="max-h-56 overflow-auto text-sm">
          {jobs.map((j) => (
            <div key={String(j.id)} className="flex justify-between border-b py-1">
              <span>
                {String(j.document_type)} · {String(j.media)}
              </span>
              <Badge>{String(j.status)}</Badge>
            </div>
          ))}
          {!jobs.length && <p className="opacity-70">No server jobs yet.</p>}
        </div>
      </Card>
    </div>
  );
}
