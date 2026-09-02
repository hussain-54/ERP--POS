import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CartZone } from "./CartZone";
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
    qty: 2,
    rate: 105000,
    listPrice: 120000,
    discount: 5000,
    discountPercent: 4.76,
    tax: 17000,
    taxRate: 0.17,
    imageUrl: "https://example.com/ac.jpg",
    stockAvailable: 10,
    category: "Appliances",
  },
  {
    id: "line-2",
    productId: "prod-2",
    name: "Copper Pipe Coil 1/2 inch",
    sku: "COP-PIPE-12",
    unitId: "unit-2",
    unitLabel: "Roll",
    qty: 1,
    rate: 8500,
    listPrice: 8500,
    discount: 0,
    discountPercent: 0,
    tax: 1445,
    taxRate: 0.17,
    imageUrl: null,
    stockAvailable: 3,
    category: "Hardware",
  },
];

describe("CartZone", () => {
  it("renders empty cart state cleanly", () => {
    const onClear = vi.fn();
    render(
      <CartZone
        lines={[]}
        customer={mockCustomer}
        onQty={vi.fn()}
        onRemove={vi.fn()}
        onClear={onClear}
        onEditDiscount={vi.fn()}
        onEditPrice={vi.fn()}
        canOverridePrice={true}
        selectedLineId={null}
        onSelectLine={vi.fn()}
      />,
    );

    expect(screen.getByText(/Your cart is empty/i)).toBeInTheDocument();
    expect(screen.getByText(/0 items · 0 pcs/i)).toBeInTheDocument();
  });

  it("renders items with original and sale prices and savings badge", () => {
    render(
      <CartZone
        lines={mockLines}
        customer={mockCustomer}
        onQty={vi.fn()}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        onEditDiscount={vi.fn()}
        onEditPrice={vi.fn()}
        canOverridePrice={true}
        selectedLineId={null}
        onSelectLine={vi.fn()}
      />,
    );

    expect(screen.getByText("Orient Split AC 1.5 Ton")).toBeInTheDocument();
    expect(screen.getByText(/SKU: AC-ORT-15/i)).toBeInTheDocument();
    expect(screen.getByText(/Save 15,000.00/i)).toBeInTheDocument();
    expect(screen.getByText("Copper Pipe Coil 1/2 inch")).toBeInTheDocument();
  });

  it("handles quantity increment, decrement, and direct input change", () => {
    const onQty = vi.fn();
    render(
      <CartZone
        lines={mockLines}
        customer={mockCustomer}
        onQty={onQty}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        onEditDiscount={vi.fn()}
        onEditPrice={vi.fn()}
        canOverridePrice={true}
        selectedLineId={null}
        onSelectLine={vi.fn()}
      />,
    );

    const plusButtons = screen.getAllByRole("button", { name: /Increase quantity/i });
    fireEvent.click(plusButtons[0]!);
    expect(onQty).toHaveBeenCalledWith("line-1", 1);

    const minusButtons = screen.getAllByRole("button", { name: /Decrease quantity/i });
    fireEvent.click(minusButtons[0]!);
    expect(onQty).toHaveBeenCalledWith("line-1", -1);

    const inputs = screen.getAllByRole("spinbutton");
    if (inputs[0]) {
      fireEvent.change(inputs[0], { target: { value: "5" } });
      expect(onQty).toHaveBeenCalledWith("line-1", 5, true);
    }
  });

  it("triggers item discount and remove actions", () => {
    const onEditDiscount = vi.fn();
    const onRemove = vi.fn();
    render(
      <CartZone
        lines={mockLines}
        customer={mockCustomer}
        onQty={vi.fn()}
        onRemove={onRemove}
        onClear={vi.fn()}
        onEditDiscount={onEditDiscount}
        onEditPrice={vi.fn()}
        canOverridePrice={true}
        selectedLineId={null}
        onSelectLine={vi.fn()}
      />,
    );

    const discountBtns = screen.getAllByTitle(/Apply or edit item discount/i);
    expect(discountBtns.length).toBeGreaterThan(0);
    fireEvent.click(discountBtns[0]!);
    expect(onEditDiscount).toHaveBeenCalledWith(mockLines[0]);

    const removeBtns = screen.getAllByTitle(/Remove item/i);
    expect(removeBtns.length).toBeGreaterThan(0);
    fireEvent.click(removeBtns[0]!);
    expect(onRemove).toHaveBeenCalledWith("line-1");
  });

  it("renders grand total and mobile proceed to payment", () => {
    const onProceed = vi.fn();
    render(
      <CartZone
        lines={mockLines}
        customer={mockCustomer}
        onQty={vi.fn()}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        onEditDiscount={vi.fn()}
        onEditPrice={vi.fn()}
        canOverridePrice={true}
        selectedLineId={null}
        onSelectLine={vi.fn()}
        onProceedToCheckout={onProceed}
      />,
    );

    expect(screen.getByText(/Grand Total/i)).toBeInTheDocument();
    const proceedBtn = screen.getByRole("button", { name: /Go to Payment/i });
    fireEvent.click(proceedBtn);
    expect(onProceed).toHaveBeenCalledTimes(1);
  });
});
