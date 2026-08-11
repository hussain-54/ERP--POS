import type { Sale } from "@electronic-erp/contracts";
import { Badge, Button, Card } from "@electronic-erp/ui";
import { posHardware } from "../hardware";

export type InvoicePreview = {
  sale: Sale;
  customerName?: string | null;
  customerMobile?: string | null;
  customerAddress?: string | null;
  items: Array<{
    id?: string;
    productId?: string | null;
    unitId?: string;
    name: string;
    qty: string | number;
    rate: number;
    discount: number;
    tax: number;
    total: number;
    warrantyDays?: number;
  }>;
  payments?: unknown[];
  logoUrl?: string | null;
};

type Format = "80mm" | "58mm" | "a4";

interface Props {
  invoice: InvoicePreview;
  format: Format;
  onFormatChange: (f: Format) => void;
  onClose?: () => void;
}

function money(n: number | string | undefined) {
  return Number(n ?? 0).toFixed(2);
}

export function buildReceiptText(invoice: InvoicePreview, format: Format): string {
  const width = format === "58mm" ? 32 : format === "80mm" ? 42 : 64;
  const line = (ch = "-") => ch.repeat(width);
  const row = (left: string, right: string) => {
    const space = Math.max(1, width - left.length - right.length);
    return `${left}${" ".repeat(space)}${right}`;
  };
  const s = invoice.sale;
  const lines = [
    "ELECTRONIC ERP",
    "Sales Invoice",
    line("="),
    `Inv: ${s.invoiceNumber}`,
    `Date: ${new Date(s.createdAt).toLocaleString()}`,
    invoice.customerName ? `Cust: ${invoice.customerName}` : "Cust: Walk-in",
    invoice.customerMobile ? `Mobile: ${invoice.customerMobile}` : "",
    line(),
    ...invoice.items.flatMap((it) => [
      String(it.name).slice(0, width),
      row(`${it.qty} x ${money(it.rate)}`, money(it.total)),
    ]),
    line(),
    row("Subtotal", money(s.subtotal)),
    row("Discount", money(s.discountTotal)),
    row("Tax", money(s.taxTotal)),
    row("TOTAL", money(s.grandTotal)),
    row("Paid", money(s.paidTotal)),
    row("Due", money(s.remainingTotal)),
    line("="),
    "Thank you",
  ].filter(Boolean);
  return lines.join("\n");
}

export function ReceiptPreview({ invoice, format, onFormatChange, onClose }: Props) {
  const s = invoice.sale;
  const text = buildReceiptText(invoice, format);
  const thermal = format !== "a4";

  async function print() {
    if (thermal) {
      await posHardware.printThermal({
        type: format === "58mm" ? "receipt_58" : "receipt_80",
        payload: text,
        documentType: "sales_invoice",
      });
    } else {
      await posHardware.printA4({
        type: "a4",
        payload: text,
        documentType: "sales_invoice",
      });
      window.print();
    }
  }

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
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => void print()}>
            Print
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const mobile = (invoice.customerMobile ?? "").replace(/\D/g, "");
              const msg = encodeURIComponent(text.slice(0, 1500));
              const url = mobile
                ? `https://wa.me/${mobile}?text=${msg}`
                : `https://wa.me/?text=${msg}`;
              window.open(url, "_blank", "noopener,noreferrer");
            }}
          >
            WhatsApp
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const subject = encodeURIComponent(`Invoice ${s.invoiceNumber}`);
              const body = encodeURIComponent(text);
              window.location.href = `mailto:?subject=${subject}&body=${body}`;
            }}
          >
            Email
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const blob = new Blob([text], { type: "application/pdf" });
              // Text is printable content; browsers open print→PDF. True PDF renderer not bundled.
              const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
              const a = document.createElement("a");
              a.href = url;
              a.download = `${s.invoiceNumber}.txt`;
              a.click();
              URL.revokeObjectURL(url);
              void blob;
              window.print();
            }}
          >
            PDF / Save
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
                <div className="text-[var(--erp-muted)]">{new Date(s.createdAt).toLocaleString()}</div>
              </div>
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
                  <th className="py-1">Rate</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((it, idx) => (
                  <tr key={idx} className="border-b border-dashed">
                    <td className="py-1.5">{it.name}</td>
                    <td className="py-1.5">{it.qty}</td>
                    <td className="py-1.5">{money(it.rate)}</td>
                    <td className="py-1.5 text-right">{money(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto w-56 space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span>{money(s.subtotal)}</span></div>
              <div className="flex justify-between"><span>Discount</span><span>{money(s.discountTotal)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>{money(s.taxTotal)}</span></div>
              <div className="flex justify-between text-base font-semibold">
                <span>Grand</span>
                <span>{money(s.grandTotal)}</span>
              </div>
              <div className="flex justify-between"><span>Paid</span><span>{money(s.paidTotal)}</span></div>
              <div className="flex justify-between"><span>Due</span><span>{money(s.remainingTotal)}</span></div>
            </div>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap">{text}</pre>
        )}
      </div>
    </Card>
  );
}
