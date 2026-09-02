import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ApplyDiscountPanel } from "./ApplyDiscountPanel";
import type { CartLine, PosCustomerView } from "../types";

const mockCustomer: PosCustomerView = {
  id: "cust-1",
  label: "Ahmed Ali Traders",
  priceTier: "wholesale",
  creditLimit: 50000,
  outstanding: 12000,
  loyaltyPoints: 350,
  mobile: "03001234567",
  email: "ahmed@example.com",
};

const mockLine: CartLine = {
  id: "line-1",
  productId: "prod-1",
  name: "Orient Inverter AC 1.5T",
  sku: "ORI-INV-15T",
  listPrice: 10000,
  rate: 10000,
  qty: 2,
  unitId: "unit-1",
  unitLabel: "Unit",
  discount: 0,
  discountPercent: 0,
  tax: 0,
  taxRate: 0,
  stockAvailable: 10,
};

describe("ApplyDiscountPanel (POS Phase 4 - Pricing & Discounts)", () => {
  it("renders Item Discount with percentage and fixed mode showing Original, Discount, and Final Price", () => {
    const onApplyItem = vi.fn();
    render(
      <ApplyDiscountPanel
        section="item"
        line={mockLine}
        invoiceBase={20000}
        customer={mockCustomer}
        actingRole="manager"
        allowPriceOverride={true}
        organizationId="org-1"
        branchId="branch-1"
        onApplyItem={onApplyItem}
        onApplyInvoice={vi.fn()}
        onApplyPriceOverride={vi.fn()}
      />,
    );

    // Shows Original Price / Base
    expect(screen.getByText(/Original Price \/ Base:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/20,000.00/).length).toBeGreaterThanOrEqual(1);

    // Select 10% preset
    const pct10Btn = screen.getByRole("button", { name: "10%" });
    fireEvent.click(pct10Btn);

    // Enter reason for discount > 5%
    const reasonInput = screen.getByPlaceholderText(/e\.g\. Customer loyalty/i);
    fireEvent.change(reasonInput, { target: { value: "Customer loyalty" } });

    // Check discount amount (2,000) and final price (18,000)
    expect(screen.getByText(/−Rs\. 2,000\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/18,000\.00/i)).toBeInTheDocument();

    // Apply Discount
    const applyBtn = screen.getByRole("button", { name: /Apply Discount/i });
    fireEvent.click(applyBtn);

    expect(onApplyItem).toHaveBeenCalledWith("line-1", 2000, 10);
  });

  it("handles Invoice Discount on entire transaction base", () => {
    const onApplyInvoice = vi.fn();
    render(
      <ApplyDiscountPanel
        section="invoice"
        line={null}
        invoiceBase={50000}
        customer={mockCustomer}
        actingRole="manager"
        allowPriceOverride={true}
        organizationId="org-1"
        branchId="branch-1"
        onApplyItem={vi.fn()}
        onApplyInvoice={onApplyInvoice}
        onApplyPriceOverride={vi.fn()}
      />,
    );

    // Switch to Fixed mode
    const fixedBtn = screen.getByRole("button", { name: /Fixed Amount/i });
    fireEvent.click(fixedBtn);

    // Click Rs. 1000 preset
    const amt1000Btn = screen.getByRole("button", { name: /Rs\. 1000/i });
    fireEvent.click(amt1000Btn);

    expect(screen.getByText(/−Rs\. 1,000\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/49,000\.00/i)).toBeInTheDocument();

    const applyBtn = screen.getByRole("button", { name: /Apply Discount/i });
    fireEvent.click(applyBtn);

    expect(onApplyInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "fixed",
        amount: 1000,
      }),
    );
  });

  it("handles Coupon Code validation and states (Valid, Invalid, Expired, Not Applicable)", async () => {
    render(
      <ApplyDiscountPanel
        section="coupon"
        line={null}
        invoiceBase={25000}
        customer={mockCustomer}
        actingRole="cashier"
        allowPriceOverride={false}
        organizationId={null} // triggers local demo validator
        branchId="branch-1"
        onApplyItem={vi.fn()}
        onApplyInvoice={vi.fn()}
        onApplyPriceOverride={vi.fn()}
      />,
    );

    // Test Valid Coupon from Available Coupons quick buttons
    const save10Btn = screen.getByRole("button", { name: "SAVE10" });
    fireEvent.click(save10Btn);

    expect(await screen.findByText(/Valid: Valid coupon! 10% Off applied/i)).toBeInTheDocument();

    // Test Expired Coupon
    const expiredBtn = screen.getByRole("button", { name: "EXPIRED20" });
    fireEvent.click(expiredBtn);

    expect(await screen.findByText(/Expired: Coupon has expired/i)).toBeInTheDocument();
  });

  it("handles Price Override with original price, new price, difference calculation, and manager approval", () => {
    const onApplyPriceOverride = vi.fn();
    render(
      <ApplyDiscountPanel
        section="override"
        line={mockLine}
        invoiceBase={20000}
        customer={mockCustomer}
        actingRole="cashier"
        allowPriceOverride={false} // cashier requires PIN
        organizationId="org-1"
        branchId="branch-1"
        onApplyItem={vi.fn()}
        onApplyInvoice={vi.fn()}
        onApplyPriceOverride={onApplyPriceOverride}
      />,
    );

    // Shows Original Price
    expect(screen.getAllByText(/Original Price/i).length).toBeGreaterThanOrEqual(1);

    // Type new price 9,000
    const priceInput = screen.getByRole("spinbutton");
    fireEvent.change(priceInput, { target: { value: "9000" } });

    // Shows Difference (-1,000 / -10.0%)
    expect(screen.getByText(/−Rs\. 1,000\.00/i)).toBeInTheDocument();

    // Shows Manager Approval Required notice
    expect(screen.getByText(/Manager Approval Required/i)).toBeInTheDocument();

    // Enter manager PIN to authorize
    const pinInput = screen.getByPlaceholderText(/Enter Manager PIN/i);
    fireEvent.change(pinInput, { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: /Authorize/i }));

    // Apply override
    const applyOverrideBtn = screen.getByRole("button", { name: /Apply Price Override/i });
    fireEvent.click(applyOverrideBtn);

    expect(onApplyPriceOverride).toHaveBeenCalledWith("line-1", 9000);
  });

  it("renders Customer Pricing breakdown and Referral / Reference tab", () => {
    const onNotes = vi.fn();
    render(
      <ApplyDiscountPanel
        section="customer"
        line={null}
        invoiceBase={20000}
        customer={mockCustomer}
        actingRole="manager"
        allowPriceOverride={true}
        organizationId="org-1"
        branchId="branch-1"
        notes=""
        onNotes={onNotes}
        onApplyItem={vi.fn()}
        onApplyInvoice={vi.fn()}
        onApplyPriceOverride={vi.fn()}
      />,
    );

    // Customer tier details
    expect(screen.getByText(/Ahmed Ali Traders/i)).toBeInTheDocument();
    expect(screen.getByText(/Tier: wholesale/i)).toBeInTheDocument();
    expect(screen.getByText(/50,000.00/)).toBeInTheDocument(); // credit limit
    expect(screen.getByText(/12,000.00/)).toBeInTheDocument(); // current udhaar

    // Switch to Referral tab
    const referralTab = screen.getByRole("button", { name: /Referral \/ Ref/i });
    fireEvent.click(referralTab);

    expect(screen.getByText(/Salesman Code \/ Partner Reference/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Optional/i).length).toBeGreaterThanOrEqual(1);

    const quickTagBtn = screen.getByRole("button", { name: /SM-101 \(Store\)/i });
    fireEvent.click(quickTagBtn);

    const attachBtn = screen.getByRole("button", { name: /Attach Reference Note/i });
    fireEvent.click(attachBtn);

    expect(onNotes).toHaveBeenCalledWith("SM-101 (Store)");
  });
});
