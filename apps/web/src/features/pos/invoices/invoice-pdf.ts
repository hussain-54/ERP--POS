import type { InvoiceView } from "@electronic-erp/contracts";

function formatDateTime(isoString?: string | null): { date: string; time: string } {
  const d = isoString ? new Date(isoString) : new Date();
  return {
    date: d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  };
}

function ascii(value: string): string {
  return Array.from(value)
    .map((ch) => (ch.charCodeAt(0) < 128 ? ch : "?"))
    .join("");
}

function pdfEscape(value: string): string {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapLine(text: string, width: number): string[] {
  const raw = ascii(text);
  if (raw.length <= width) return [raw];
  const out: string[] = [];
  let rest = raw;
  while (rest.length > width) {
    let cut = rest.lastIndexOf(" ", width);
    if (cut < 20) cut = width;
    out.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

function money(n: number): string {
  return `Rs. ${n.toFixed(2)}`;
}

export function buildInvoicePdfLines(invoice: InvoiceView, companyName: string): string[] {
  const invNum = invoice.invoiceNumber ?? `INV-${Date.now()}`;
  const dt = formatDateTime(invoice.dateTime ?? invoice.sale?.createdAt);
  const grand = Number(invoice.sale?.grandTotal ?? 0);
  const tax = Number(invoice.sale?.taxTotal ?? 0);
  const disc = Number(invoice.sale?.discountTotal ?? 0);
  const subtotal = Number(invoice.sale?.subtotal ?? grand + disc - tax);
  const paid = Number(invoice.sale?.paidTotal ?? invoice.paidAmount ?? grand);
  const remaining = Number(invoice.sale?.remainingTotal ?? invoice.remainingAmount ?? Math.max(0, grand - paid));
  const change = Math.max(0, paid - grand);
  const taxable = Math.max(0, Number((subtotal - disc).toFixed(2)));
  const paymentMethod = invoice.payments?.length
    ? invoice.payments.map((p) => `${p.method}${p.reference ? ` ref ${p.reference}` : ""}`).join(", ")
    : "Cash";
  const refs = (invoice.payments ?? [])
    .map((p) => p.reference)
    .filter((r): r is string => Boolean(r));

  const lines: string[] = [
    companyName.toUpperCase(),
    `Branch: ${invoice.branchName ?? "Main Branch"}`,
    "Address: Main Market",
    "Contact: 0300-0000000",
    "TAX INVOICE / A4",
    `Invoice: ${invNum}`,
    `Date: ${dt.date}   Time: ${dt.time}`,
    `POS / Terminal: ${invoice.terminalId ?? invoice.sale?.deviceId ?? "POS-01"}`,
    `Cashier: ${invoice.cashierName ?? "Counter Cashier"}`,
    `Customer: ${invoice.customerName ?? "Walk-in Customer"}`,
    `Phone: ${invoice.customerMobile ?? "-"}`,
    `Email: ${invoice.customerEmail ?? "-"}`,
    "----------------------------------------------",
    "Product / SKU / Qty / Price / Disc / Total",
    "----------------------------------------------",
  ];

  for (const item of invoice.items ?? []) {
    const rate = Number(item.rate ?? 0);
    const list = Number(item.listPrice ?? rate);
    const qty = Number(item.qty ?? 0);
    const itemDisc = Number(item.discount ?? 0);
    const total = Number(item.total ?? qty * rate - itemDisc);
    lines.push(...wrapLine(`${item.name}`, 52));
    lines.push(`  SKU: ${item.sku ?? "-"}  Qty: ${qty} ${item.unit || "Pcs"}`);
    lines.push(
      `  Unit ${money(rate)}${list > rate + 0.009 ? `  Orig ${money(list)}` : ""}  Disc ${money(itemDisc)}  ${money(total)}`,
    );
  }

  lines.push("----------------------------------------------");
  lines.push(`Subtotal                 ${money(subtotal)}`);
  lines.push(`Discount                 ${money(disc)}`);
  lines.push(`Taxable Amount           ${money(taxable)}`);
  lines.push(`GST / Tax                ${money(tax)}`);
  lines.push(`GRAND TOTAL              ${money(grand)}`);
  lines.push("----------------------------------------------");
  lines.push(`Payment Method           ${paymentMethod}`);
  lines.push(`Amount Paid              ${money(paid)}`);
  lines.push(`Change                   ${money(change)}`);
  if (remaining > 0) lines.push(`Balance / Udhaar         ${money(remaining)}`);
  if (refs.length) lines.push(`Payment Reference        ${refs.join(", ")}`);
  lines.push("----------------------------------------------");
  lines.push("Thank you for your business.");
  return lines;
}

function contentStream(pageLines: string[]): string {
  const ops: string[] = ["BT", "/F1 10 Tf", "50 800 Td"];
  pageLines.forEach((line, idx) => {
    if (idx > 0) ops.push("0 -14 Td");
    ops.push(`(${pdfEscape(line)}) Tj`);
  });
  ops.push("ET");
  return ops.join("\n");
}

function assemblePdf(streams: string[]): Uint8Array {
  const pageCount = streams.length;
  const fontId = 3 + pageCount * 2;
  const objects: string[] = new Array(fontId);

  const kids = streams.map((_, i) => `${3 + i * 2} 0 R`).join(" ");
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [ ${kids} ] /Count ${pageCount} >>`;

  streams.forEach((stream, i) => {
    const pageId = 3 + i * 2;
    const contentId = 4 + i * 2;
    objects[pageId - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId - 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontId - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  const encoder = new TextEncoder();
  const header = "%PDF-1.4\n";
  const parts: Uint8Array[] = [encoder.encode(header)];
  const offsets = [0];
  let offset = header.length;
  objects.forEach((body, i) => {
    const obj = `${i + 1} 0 obj\n${body}\nendobj\n`;
    const bytes = encoder.encode(obj);
    offsets.push(offset);
    parts.push(bytes);
    offset += bytes.length;
  });

  const xrefStart = offset;
  const xrefLines = [`xref`, `0 ${objects.length + 1}`, `0000000000 65535 f `];
  for (let i = 1; i <= objects.length; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n `);
  }
  const xref = `${xrefLines.join("\n")}\n`;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  parts.push(encoder.encode(xref), encoder.encode(trailer));

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const p of parts) {
    out.set(p, cursor);
    cursor += p.length;
  }
  return out;
}

/** Builds a real PDF-1.4 document (Helvetica, A4) for the invoice. */
export function buildInvoicePdfBytes(
  invoice: InvoiceView,
  companyName = "Electronic & Electrical Store",
): Uint8Array {
  const lines = buildInvoicePdfLines(invoice, companyName);
  const perPage = 52;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) {
    pages.push(lines.slice(i, i + perPage));
  }
  if (pages.length === 0) pages.push(["(empty invoice)"]);
  return assemblePdf(pages.map(contentStream));
}
