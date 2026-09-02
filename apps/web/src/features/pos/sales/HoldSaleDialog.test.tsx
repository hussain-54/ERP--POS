import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HoldSaleDialog } from "./HoldSaleDialog";
import type { PosCustomerView } from "../types";

const mockCustomer: PosCustomerView = {
  id: "cust-1",
  label: "Tariq Mahmood",
  priceTier: "retail",
  creditLimit: 20000,
  outstanding: 0,
  loyaltyPoints: 100,
  mobile: "03001234567",
};

describe("HoldSaleDialog (POS Phase 6 - Real Retail Operations)", () => {
  it("renders cart summary with item count, total value, and optional fields", () => {
    const onClose = vi.fn();
    const onConfirmHold = vi.fn();

    render(
      <HoldSaleDialog
        open={true}
        itemCount={3}
        grandTotal={14500}
        customer={mockCustomer}
        onClose={onClose}
        onConfirmHold={onConfirmHold}
      />,
    );

    expect(screen.getByText(/Hold Current Sale/i)).toBeInTheDocument();
    expect(screen.getByText(/3 Items in Cart/i)).toBeInTheDocument();
    expect(screen.getByText(/14,500.00/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ali Ahmed \/ Walk-in/i)).toHaveValue("Tariq Mahmood");
    expect(screen.getByPlaceholderText(/Token-42, Counter 2/i)).toBeInTheDocument();
  });

  it("submits hold with customer, reference, and note when confirmed", async () => {
    const onConfirmHold = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <HoldSaleDialog
        open={true}
        itemCount={2}
        grandTotal={5000}
        customer={mockCustomer}
        onClose={onClose}
        onConfirmHold={onConfirmHold}
      />,
    );

    const refInput = screen.getByPlaceholderText(/Token-42, Counter 2/i);
    const noteInput = screen.getByPlaceholderText(/Waiting for spouse to confirm/i);

    fireEvent.change(refInput, { target: { value: "Counter 1 - Token 09" } });
    fireEvent.change(noteInput, { target: { value: "Customer stepped out for cash" } });

    fireEvent.click(screen.getByRole("button", { name: /Hold Sale/i }));

    expect(onConfirmHold).toHaveBeenCalledWith({
      customerName: "Tariq Mahmood",
      reference: "Counter 1 - Token 09",
      notes: "Customer stepped out for cash",
    });
  });
});
