import type { Sale } from "@electronic-erp/contracts";
import {
  assertInvoiceActionSupported,
  buildSaleInvoiceDocument,
  renderSaleInvoiceText,
  type InvoiceAction,
} from "@electronic-erp/domain";
import { Badge, Button, Card } from "@electronic-erp/ui";
import { useEffect } from "react";
import { posHardware } from "../hardware";

export type InvoicePreview = {
  sale: Sale;
  invoiceNumber?: string;
  dateTime?: string;
  branchId?: string;
  branchName?: string | null;
  terminalId?: string | null;
  cashierId?: string | null;
  cashierName?: string | null;
  customerName?: string | null;
  customerMobile?: string | null;
  customerAddress?: string | null;
  customerEmail?: string | null;
  reference?: string | null;
  salesmanId?: string | null;
  salesmanName?: string | null;
  commissionPercent?: number | null;
  commissionAmount?: number | null;
  dueDate?: string | null;
  terms?: string | null;
  warrantyNotes?: string | null;
  paidAmount?: number;
  remainingAmount?: number;
  items: Array<{
    id?: string;
    productId?: string | null;
    unitId?: string;
    name: string;
    qty: string | number;
    unit?: string | null;
    rate: number;
    discount: number;
    tax: number;
    total: number;
    warrantyDays?: number;
  }>;
  payments?: Array<{ method: string; amount: number; reference?: string | null }>;
  logoUrl?: string | null;
};

type Format = "80mm" | "58mm" | "a4";

interface Props {
  invoice: InvoicePreview;
  format: Format;
  onFormatChange: (f: Format) => void;
  onClose?: () => void;
  /** Run a supported invoice action once after open (print / download). */
  autoAction?: InvoiceAction;
}

function money(n: number | string | undefined) {
  return Number(n ?? 0).toFixed(2);
}

function toDocument(invoice: InvoicePreview) {
  const s = invoice.sale;
  return buildSaleInvoiceDocument({
    sale: s,
    branchName: invoice.branchName,
    terminalId: invoice.terminalId ?? s.deviceId,
    cashierName: invoice.cashierName,
    customerName: invoice.customerName,
    customerMobile: invoice.customerMobile,
    customerAddress: invoice.customerAddress,
    salesmanName: invoice.salesmanName,
    commissionPercent: invoice.commissionPercent,
    commissionAmount: invoice.commissionAmount,
    terms: invoice.terms ?? s.notes,
    warrantyNotes: invoice.warrantyNotes,
    items: invoice.items.map((it) => ({
      name: it.name,
      qty: it.qty,
      unit: it.unit ?? null,
      rate: it.rate,
      discount: it.discount,
      tax: it.tax,
      total: it.total,
      warrantyDays: it.warrantyDays ?? 0,
    })),
    payments: (invoice.payments ?? []).map((p) => ({
      method: p.method,
      amount: p.amount,
    })),
  });
}

export function buildReceiptText(invoice: InvoicePreview, format: Format): string {
  return renderSaleInvoiceText(toDocument(invoice), format);
}

function downloadText(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReceiptPreview({ invoice, format, onFormatChange, onClose, autoAction }: Props) {
  const s = invoice.sale;
  const doc = toDocument(invoice);
  const text = renderSaleInvoiceText(doc, format);
  const thermal = format !== "a4";
  const paid = invoice.paidAmount ?? s.paidTotal;
  const remaining = invoice.remainingAmount ?? s.remainingTotal;
  const dueDate = invoice.dueDate ?? s.dueDate;
  const paymentMethods = (invoice.payments ?? [])
    .map((p) => p.method)
    .filter(Boolean)
    .join(", ");

  async function runAction(action: InvoiceAction) {
    assertInvoiceActionSupported(action);
    if (action === "save") {
      downloadText(`${s.invoiceNumber}.txt`, text, "text/plain");
      return;
    }
    if (action === "download_pdf") {
      // Honest path: printable text + browser print-to-PDF (no PDF lib bundled).
      downloadText(`${s.invoiceNumber}.txt`, text, "text/plain");
      window.print();
      return;
    }
    if (action === "print_80mm" || action === "print_58mm") {
      const f = action === "print_58mm" ? "58mm" : "80mm";
      const payload = renderSaleInvoiceText(doc, f);
      await posHardware.printThermal({
        type: f === "58mm" ? "receipt_58" : "receipt_80",
        payload,
        documentType: "sales_invoice",
      });
      return;
    }
    if (action === "print_a4") {
      await posHardware.printA4({
        type: "a4",
        payload: renderSaleInvoiceText(doc, "a4"),
        documentType: "sales_invoice",
      });
      window.print();
      return;
    }
    if (action === "whatsapp") {
      const mobile = (invoice.customerMobile ?? "").replace(/\D/g, "");
      const msg = encodeURIComponent(text.slice(0, 1500));
      const url = mobile ? `https://wa.me/${mobile}?text=${msg}` : `https://wa.me/?text=${msg}`;
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (action === "email") {
      const to = invoice.customerEmail ? encodeURIComponent(invoice.customerEmail) : "";
      const subject = encodeURIComponent(`Invoice ${s.invoiceNumber}`);
      const body = encodeURIComponent(text);
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    }
  }

  useEffect(() => {
    if (!autoAction) return;
    void runAction(autoAction);
    // Open-once: print/download after the invoice payload is on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAction, s.id]);

  return (
    <Card className="space-y-3" title={`Invoice ${s.invoiceNumber}`}>
      <div className="flex flex-wrap items-center gap-2">
        {(["80mm", "58mm", "a4"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={format === f ? "primary" : "secondary"}
            onClick={() => onFormatChange(f)}
          >
            {f.toUpperCase()}
          </Button>
        ))}
        <Badge tone={s.paymentStatus === "paid" ? "success" : "warning"}>{s.paymentStatus}</Badge>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => void runAction("save")}>
            Save
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void runAction("print_a4")}>
            Print A4
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void runAction("print_80mm")}>
            Print 80mm
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void runAction("print_58mm")}>
            Print 58mm
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void runAction("download_pdf")}>
            Download PDF
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void runAction("whatsapp")}>
            WhatsApp
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void runAction("email")}>
            Email
          </Button>
          {onClose ? (
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className={`mx-auto overflow-auto rounded-lg border border-[var(--erp-border)] bg-white p-4 font-mono text-xs leading-relaxed shadow-sm ${
          thermal ? "max-w-[320px]" : "max-w-3xl"
        }`}
      >
        {!thermal ? (
          <div className="space-y-4 text-sm">
            <div className="flex justify-between border-b pb-3">
              <div>
                <div className="text-lg font-semibold">Electronic ERP</div>
                <div className="text-[var(--erp-muted)]">Tax Invoice</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{s.invoiceNumber}</div>
                <div className="text-[var(--erp-muted)]">
                  {new Date(invoice.dateTime ?? s.postedAt ?? s.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              <div>Branch: {invoice.branchName ?? s.branchId}</div>
              <div>Terminal: {invoice.terminalId ?? s.deviceId ?? "—"}</div>
              <div>Cashier: {invoice.cashierName ?? "—"}</div>
              <div>Salesman: {invoice.salesmanName ?? "—"}</div>
              <div>Reference: {invoice.reference ?? s.referenceName ?? "—"}</div>
              <div>Due: {dueDate ?? "—"}</div>
            </div>
            <div>
              <div className="font-medium">{invoice.customerName ?? "Walk-in customer"}</div>
              {invoice.customerMobile ? <div>{invoice.customerMobile}</div> : null}
              {invoice.customerAddress ? <div>{invoice.customerAddress}</div> : null}
            </div>
            <table className="w-full text-left">
              <thead className="border-b text-[var(--erp-muted)]">
                <tr>
                  <th className="py-1">Item</th>
                  <th className="py-1">Qty</th>
                  <th className="py-1">Unit</th>
                  <th className="py-1">Rate</th>
                  <th className="py-1">Disc</th>
                  <th className="py-1">Tax</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((it, idx) => (
                  <tr key={idx} className="border-b border-dashed">
                    <td className="py-1.5">
                      {it.name}
                      {(it.warrantyDays ?? 0) > 0 ? (
                        <div className="text-[10px] text-[var(--erp-muted)]">
                          Warranty {it.warrantyDays}d
                        </div>
                      ) : null}
                    </td>
                    <td className="py-1.5">{it.qty}</td>
                    <td className="py-1.5">{it.unit ?? "—"}</td>
                    <td className="py-1.5">{money(it.rate)}</td>
                    <td className="py-1.5">{money(it.discount)}</td>
                    <td className="py-1.5">{money(it.tax)}</td>
                    <td className="py-1.5 text-right">{money(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto w-64 space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span>{money(s.subtotal)}</span></div>
              <div className="flex justify-between"><span>Discount</span><span>{money(s.discountTotal)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>{money(s.taxTotal)}</span></div>
              <div className="flex justify-between text-base font-semibold">
                <span>Grand</span>
                <span>{money(s.grandTotal)}</span>
              </div>
              <div className="flex justify-between"><span>Payment</span><span>{paymentMethods || "—"}</span></div>
              <div className="flex justify-between"><span>Paid</span><span>{money(paid)}</span></div>
              <div className="flex justify-between"><span>Remaining</span><span>{money(remaining)}</span></div>
              {invoice.commissionAmount != null && invoice.commissionAmount > 0 ? (
                <div className="flex justify-between">
                  <span>Commission</span>
                  <span>{money(invoice.commissionAmount)}</span>
                </div>
              ) : null}
            </div>
            {invoice.warrantyNotes ? <div>Warranty: {invoice.warrantyNotes}</div> : null}
            {invoice.terms ? <div>Terms: {invoice.terms}</div> : null}
          </div>
        ) : (
          <pre className="whitespace-pre-wrap">{text}</pre>
        )}
      </div>
    </Card>
  );
}
