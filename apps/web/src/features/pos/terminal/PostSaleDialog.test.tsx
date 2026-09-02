import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PostSaleDialog } from "./PostSaleDialog";
import type { InvoiceView } from "@electronic-erp/contracts";
import * as invoiceUtils from "../invoices/invoice-utils";

const mockInvoice: InvoiceView = {
  invoiceNumber: "INV-928173",
  customerName: "Ahmed Electronics",
  customerMobile: "03001234567",
  customerEmail: "ahmed@example.com",
  branchName: "Main Branch",
  cashierName: "Cashier 01",
  dateTime: "2026-08-31T15:30:00.000Z",
  sale: {
    id: "sale-1",
    organizationId: "org-1",
    branchId: "branch-1",
    warehouseId: "wh-1",
    invoiceNumber: "INV-928173",
    subtotal: 10000,
    discountTotal: 500,
    taxTotal: 1615,
    grandTotal: 11115,
    paidTotal: 12000,
    remainingTotal: 0,
    posMode: "easy",
    localeMode: "en",
    status: "posted",
    paymentStatus: "paid",
    idempotencyKey: "idem-1",
    createdAt: "2026-08-31T15:30:00.000Z",
    updatedAt: "2026-08-31T15:30:00.000Z",
    version: 1,
  },
  items: [
    {
      name: "Orient Inverter AC 1.5T",
      unit: "Unit",
      qty: 1,
      rate: 10000,
      discount: 500,
      tax: 1615,
      total: 9500,
    },
  ],
  payments: [
    {
      method: "Cash",
      amount: 12000,
      reference: null,
    },
  ],
};

describe("PostSaleDialog (POS Phase 3 - Professional Invoice & Receipt)", () => {
  it("renders Sale Completed header, invoice number, items, and financial summary cleanly", () => {
    render(
      <PostSaleDialog
        open={true}
        invoice={mockInvoice}
        paidAmount={12000}
        changeAmount={885}
        paymentMethod="Cash"
        onClose={vi.fn()}
        onNewSale={vi.fn()}
      />,
    );

    expect(screen.getByText(/✓ Sale Completed/i)).toBeInTheDocument();
    expect(screen.getByText(/#INV-928173/i)).toBeInTheDocument();
    expect(screen.getByText(/Ahmed Electronics/i)).toBeInTheDocument();
    expect(screen.getByText(/Orient Inverter AC 1.5T/i)).toBeInTheDocument();
    expect(screen.getByText(/11,115.00/)).toBeInTheDocument(); // Grand total
    expect(screen.getByText(/12,000.00/)).toBeInTheDocument(); // Amount Paid
    expect(screen.getByText(/885.00/)).toBeInTheDocument(); // Change Returned
  });

  it("handles Print Receipt and Download PDF actions", () => {
    const printSpy = vi.spyOn(invoiceUtils, "printInvoiceReceipt").mockReturnValue(true);
    const pdfSpy = vi.spyOn(invoiceUtils, "downloadPdfInvoice").mockReturnValue(true);

    render(
      <PostSaleDialog
        open={true}
        invoice={mockInvoice}
        paidAmount={12000}
        changeAmount={885}
        paymentMethod="Cash"
        onClose={vi.fn()}
        onNewSale={vi.fn()}
      />,
    );

    const printBtn = screen.getByRole("button", { name: /PRINT RECEIPT/i });
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalled();

    const pdfBtn = screen.getByRole("button", { name: /DOWNLOAD PDF/i });
    fireEvent.click(pdfBtn);
    expect(pdfSpy).toHaveBeenCalled();
  });

  it("handles WhatsApp share and Email receipt actions", () => {
    const waSpy = vi.spyOn(invoiceUtils, "openWhatsAppReceipt").mockReturnValue(true);
    const emailSpy = vi.spyOn(invoiceUtils, "openEmailReceipt").mockReturnValue(true);

    render(
      <PostSaleDialog
        open={true}
        invoice={mockInvoice}
        paidAmount={12000}
        changeAmount={885}
        paymentMethod="Cash"
        onClose={vi.fn()}
        onNewSale={vi.fn()}
      />,
    );

    const waBtn = screen.getByRole("button", { name: /WHATSAPP/i });
    fireEvent.click(waBtn);
    expect(waSpy).toHaveBeenCalled();

    const emailBtn = screen.getByRole("button", { name: /EMAIL/i });
    fireEvent.click(emailBtn);
    expect(emailSpy).toHaveBeenCalled();
  });

  it("triggers Start New Sale action on CTA button", () => {
    const onNewSale = vi.fn();
    render(
      <PostSaleDialog
        open={true}
        invoice={mockInvoice}
        paidAmount={12000}
        changeAmount={885}
        paymentMethod="Cash"
        onClose={vi.fn()}
        onNewSale={onNewSale}
      />,
    );

    const newSaleBtn = screen.getByRole("button", { name: /START NEW SALE/i });
    fireEvent.click(newSaleBtn);
    expect(onNewSale).toHaveBeenCalledTimes(1);
  });
});
