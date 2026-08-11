export type PrintDocumentType =
  | "sales_invoice"
  | "purchase_invoice"
  | "payment_receipt"
  | "installment_receipt"
  | "quotation"
  | "delivery_challan"
  | "warranty_card"
  | "repair_job_card"
  | "barcode_label"
  | "stock_report";

export type PrintMediaType = "a4" | "receipt_80" | "receipt_58" | "label" | "barcode";

export interface PrintDocumentJob {
  documentType: PrintDocumentType;
  media: PrintMediaType;
  title: string;
  lines: string[];
  meta?: Record<string, string | number | null | undefined>;
  copies?: number;
  barcodeValue?: string;
}

const MEDIA_FOR_DOC: Record<PrintDocumentType, PrintMediaType> = {
  sales_invoice: "receipt_80",
  purchase_invoice: "a4",
  payment_receipt: "receipt_58",
  installment_receipt: "receipt_58",
  quotation: "a4",
  delivery_challan: "a4",
  warranty_card: "a4",
  repair_job_card: "a4",
  barcode_label: "label",
  stock_report: "a4",
};

export function defaultMediaForDocument(doc: PrintDocumentType): PrintMediaType {
  return MEDIA_FOR_DOC[doc];
}

/** Pure template renderer — adapters receive final text payload. */
export function renderPrintDocument(job: PrintDocumentJob): string {
  const width =
    job.media === "receipt_58" ? 32 : job.media === "receipt_80" ? 42 : job.media === "label" ? 28 : 72;
  const rule = "=".repeat(Math.min(width, 48));
  const metaLines = Object.entries(job.meta ?? {})
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${v}`);
  const body = [
    rule,
    center(job.title, width),
    rule,
    ...metaLines,
    "",
    ...job.lines,
    "",
    job.barcodeValue ? `*${job.barcodeValue}*` : "",
    rule,
    center("Thank you", width),
    rule,
  ]
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n");
  return body;
}

function center(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const pad = Math.floor((width - text.length) / 2);
  return `${" ".repeat(pad)}${text}`;
}

export function buildSalesInvoice(input: {
  invoiceNumber: string;
  date: string;
  customer?: string;
  lines: Array<{ name: string; qty: number | string; amount: number }>;
  grandTotal: number;
  media?: PrintMediaType;
}): PrintDocumentJob {
  return {
    documentType: "sales_invoice",
    media: input.media ?? "receipt_80",
    title: "SALES INVOICE",
    meta: {
      Invoice: input.invoiceNumber,
      Date: input.date,
      Customer: input.customer ?? "Walk-in",
    },
    lines: [
      ...input.lines.map((l) => `${l.name} x${l.qty}  ${l.amount.toFixed(2)}`),
      `TOTAL: ${input.grandTotal.toFixed(2)}`,
    ],
  };
}

export function buildBarcodeLabel(input: {
  productName: string;
  barcode: string;
  price?: number;
}): PrintDocumentJob {
  return {
    documentType: "barcode_label",
    media: "label",
    title: input.productName.slice(0, 24),
    meta: input.price != null ? { Price: input.price.toFixed(2) } : {},
    lines: [input.barcode],
    barcodeValue: input.barcode,
  };
}

export function buildPaymentReceipt(input: {
  receiptNumber: string;
  amount: number;
  method?: string;
  party?: string;
}): PrintDocumentJob {
  return {
    documentType: "payment_receipt",
    media: "receipt_58",
    title: "PAYMENT RECEIPT",
    meta: {
      Receipt: input.receiptNumber,
      Party: input.party ?? "",
      Method: input.method ?? "cash",
    },
    lines: [`Amount: ${input.amount.toFixed(2)}`],
  };
}

export function buildQuotationDoc(input: {
  quotationNumber: string;
  customer?: string;
  lines: string[];
  grandTotal: number;
}): PrintDocumentJob {
  return {
    documentType: "quotation",
    media: "a4",
    title: "QUOTATION",
    meta: { No: input.quotationNumber, Customer: input.customer ?? "" },
    lines: [...input.lines, `Grand Total: ${input.grandTotal.toFixed(2)}`],
  };
}

export function buildDeliveryChallan(input: {
  deliveryNumber: string;
  lines: string[];
}): PrintDocumentJob {
  return {
    documentType: "delivery_challan",
    media: "a4",
    title: "DELIVERY CHALLAN",
    meta: { No: input.deliveryNumber },
    lines: input.lines,
  };
}

export function buildWarrantyCard(input: {
  serial?: string;
  productName: string;
  warrantyEnd: string;
}): PrintDocumentJob {
  return {
    documentType: "warranty_card",
    media: "a4",
    title: "WARRANTY CARD",
    meta: {
      Product: input.productName,
      Serial: input.serial ?? "",
      ValidUntil: input.warrantyEnd,
    },
    lines: ["Present this card for warranty claims."],
  };
}

export function buildRepairJobCard(input: {
  jobNumber: string;
  customer?: string;
  device?: string;
  status: string;
}): PrintDocumentJob {
  return {
    documentType: "repair_job_card",
    media: "a4",
    title: "REPAIR JOB CARD",
    meta: {
      Job: input.jobNumber,
      Customer: input.customer ?? "",
      Device: input.device ?? "",
      Status: input.status,
    },
    lines: ["Parts & labor as diagnosed."],
  };
}

export function buildStockReport(input: {
  title?: string;
  rows: Array<{ sku: string; name: string; qty: string | number }>;
}): PrintDocumentJob {
  return {
    documentType: "stock_report",
    media: "a4",
    title: input.title ?? "STOCK REPORT",
    lines: input.rows.map((r) => `${r.sku}  ${r.name}  qty=${r.qty}`),
  };
}

export function buildPurchaseInvoice(input: {
  invoiceNumber: string;
  supplier?: string;
  lines: string[];
  grandTotal: number;
}): PrintDocumentJob {
  return {
    documentType: "purchase_invoice",
    media: "a4",
    title: "PURCHASE INVOICE",
    meta: { Invoice: input.invoiceNumber, Supplier: input.supplier ?? "" },
    lines: [...input.lines, `TOTAL: ${input.grandTotal.toFixed(2)}`],
  };
}

export function buildInstallmentReceipt(input: {
  planRef: string;
  amount: number;
  installmentNo?: number;
}): PrintDocumentJob {
  return {
    documentType: "installment_receipt",
    media: "receipt_58",
    title: "INSTALLMENT RECEIPT",
    meta: {
      Plan: input.planRef,
      Installment: input.installmentNo ?? "",
    },
    lines: [`Paid: ${input.amount.toFixed(2)}`],
  };
}
