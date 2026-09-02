import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CheckoutStage } from "./CheckoutStage";
import type { CartLine, PosCustomerView } from "../types";

const mockCustomer: PosCustomerView = {
  id: "cust-1",
  label: "Ahmed Electronics",
  priceTier: "Wholesale",
  creditLimit: 50000,
  outstanding: 12000,
  loyaltyPoints: 150,
  mobile: "03001234567",
};

const mockLines: CartLine[] = [
  {
    id: "line-1",
    productId: "prod-1",
    name: "Orient Split AC 1.5 Ton",
    sku: "AC-ORT-15",
    unitId: "unit-1",
    unitLabel: "Unit",
    qty: 1,
    rate: 1000,
    listPrice: 1200,
    discount: 200,
    discountPercent: 16.67,
    tax: 170,
    taxRate: 0.17,
    imageUrl: null,
    stockAvailable: 5,
    category: "Appliances",
  },
];

const mockTotals = {
  itemCount: 1,
  totalQty: 1,
  taxable: 1000,
  itemDiscount: 200,
  invoiceDiscount: 0,
  tax: 170,
  subtotal: 1000,
  totalDiscount: 200,
  deliveryCharges: 0,
  grand: 1170,
};

const mockMethodsByKind = {
  cash: "meth-cash-1",
  card: "meth-card-1",
  bank: "meth-bank-1",
  online: "meth-online-1",
  qr: "meth-qr-1",
  jazzcash: "meth-jazz-1",
  easypaisa: "meth-easy-1",
};

describe("CheckoutStage (Redesigned POS Payment UX)", () => {
  it("renders prominent Total Payable, summary, and primary payment methods cleanly", () => {
    render(
      <CheckoutStage
        lines={mockLines}
        customer={mockCustomer}
        totals={mockTotals}
        paymentKind="cash"
        onPaymentKind={vi.fn()}
        couponCode=""
        notes=""
        onNotes={vi.fn()}
        onSelectCustomer={vi.fn()}
        onWalkIn={vi.fn()}
        onNewCustomer={vi.fn()}
        onDiscount={vi.fn()}
        onHold={vi.fn()}
        onBackToCart={vi.fn()}
        onComplete={vi.fn()}
        methodsByKind={mockMethodsByKind}
      />,
    );

    expect(screen.getByText(/Total Payable/i)).toBeInTheDocument();
    const amounts = screen.getAllByText(/1,170.00/i);
    expect(amounts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /^Cash/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Card/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Bank Transfer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^QR Payment/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Mobile Wallet/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Credit \/ Udhaar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Split Payment/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Partial Payment/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Installment/i })).toBeInTheDocument();
  });

  it("handles cash payment with exact and smart quick amount buttons and change calculation", () => {
    const onCashReceived = vi.fn();
    render(
      <CheckoutStage
        lines={mockLines}
        customer={mockCustomer}
        totals={mockTotals}
        paymentKind="cash"
        cashReceived={2000}
        onCashReceived={onCashReceived}
        onPaymentKind={vi.fn()}
        couponCode=""
        notes=""
        onNotes={vi.fn()}
        onSelectCustomer={vi.fn()}
        onWalkIn={vi.fn()}
        onNewCustomer={vi.fn()}
        onDiscount={vi.fn()}
        onHold={vi.fn()}
        onBackToCart={vi.fn()}
        onComplete={vi.fn()}
        methodsByKind={mockMethodsByKind}
      />,
    );

    expect(screen.getByText(/Change to Return/i)).toBeInTheDocument();
    expect(screen.getByText(/830.00/)).toBeInTheDocument(); // 2000 - 1170 = 830

    // Quick presets
    const exactBtns = screen.getAllByRole("button", { name: /Exact/i });
    expect(exactBtns.length).toBeGreaterThan(0);
    fireEvent.click(exactBtns[0]!);
    expect(onCashReceived).toHaveBeenCalledWith(1170);
  });

  it("reveals sub-wallet providers when Mobile Wallet is selected", () => {
    const onPaymentKind = vi.fn();
    render(
      <CheckoutStage
        lines={mockLines}
        customer={mockCustomer}
        totals={mockTotals}
        paymentKind="jazzcash"
        onPaymentKind={onPaymentKind}
        couponCode=""
        notes=""
        onNotes={vi.fn()}
        onSelectCustomer={vi.fn()}
        onWalkIn={vi.fn()}
        onNewCustomer={vi.fn()}
        onDiscount={vi.fn()}
        onHold={vi.fn()}
        onBackToCart={vi.fn()}
        onComplete={vi.fn()}
        methodsByKind={mockMethodsByKind}
      />,
    );

    expect(screen.getByText("JazzCash")).toBeInTheDocument();
    expect(screen.getByText("Easypaisa")).toBeInTheDocument();
    expect(screen.getByText("SadaPay")).toBeInTheDocument();
    expect(screen.getByText("Other Wallet")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Easypaisa"));
    expect(onPaymentKind).toHaveBeenCalledWith("easypaisa");
  });

  it("handles Credit / Udhaar display with customer outstanding and headroom", () => {
    render(
      <CheckoutStage
        lines={mockLines}
        customer={mockCustomer}
        totals={mockTotals}
        paymentKind="credit"
        onPaymentKind={vi.fn()}
        couponCode=""
        notes=""
        onNotes={vi.fn()}
        onSelectCustomer={vi.fn()}
        onWalkIn={vi.fn()}
        onNewCustomer={vi.fn()}
        onDiscount={vi.fn()}
        onHold={vi.fn()}
        onBackToCart={vi.fn()}
        onComplete={vi.fn()}
        methodsByKind={mockMethodsByKind}
      />,
    );

    expect(screen.getByText("Udhaar Sale")).toBeInTheDocument();
    expect(screen.getByText(/Current Udhaar/i)).toBeInTheDocument();
    expect(screen.getByText(/New Total Balance/i)).toBeInTheDocument();
    expect(screen.getByText(/Credit available/i)).toBeInTheDocument();
  });

  it("triggers Confirm Payment action on dominant CTA button", () => {
    const onComplete = vi.fn();
    render(
      <CheckoutStage
        lines={mockLines}
        customer={mockCustomer}
        totals={mockTotals}
        paymentKind="cash"
        cashReceived={1170}
        onPaymentKind={vi.fn()}
        couponCode=""
        notes=""
        onNotes={vi.fn()}
        onSelectCustomer={vi.fn()}
        onWalkIn={vi.fn()}
        onNewCustomer={vi.fn()}
        onDiscount={vi.fn()}
        onHold={vi.fn()}
        onBackToCart={vi.fn()}
        onComplete={onComplete}
        methodsByKind={mockMethodsByKind}
      />,
    );

    const completeBtns = screen.getAllByRole("button", { name: /CONFIRM PAYMENT/i });
    expect(completeBtns.length).toBeGreaterThan(0);
    fireEvent.click(completeBtns[0]!);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
