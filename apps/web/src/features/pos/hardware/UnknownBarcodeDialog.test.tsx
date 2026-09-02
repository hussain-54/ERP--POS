import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnknownBarcodeDialog } from "./UnknownBarcodeDialog";

describe("UnknownBarcodeDialog (POS Phase 5 - Scanning & Hardware)", () => {
  it("renders Product not found with scanned barcode code and 3 options", () => {
    const onSearch = vi.fn();
    const onManual = vi.fn();
    const onCreate = vi.fn();
    const onClose = vi.fn();

    render(
      <UnknownBarcodeDialog
        open={true}
        barcode="UNKNOWN-889922"
        hasCreatePermission={true}
        onClose={onClose}
        onSearchProduct={onSearch}
        onManualEntry={onManual}
        onCreateProduct={onCreate}
      />,
    );

    expect(screen.getByText(/Product not found\./i)).toBeInTheDocument();
    expect(screen.getByText(/UNKNOWN-889922/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Search Product/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Manual Entry/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Product/i })).toBeInTheDocument();
  });

  it("calls onSearchProduct when Search Product is selected", () => {
    const onSearch = vi.fn();
    const onClose = vi.fn();

    render(
      <UnknownBarcodeDialog
        open={true}
        barcode="SKU-999"
        onClose={onClose}
        onSearchProduct={onSearch}
        onManualEntry={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Search Product/i }));
    expect(onSearch).toHaveBeenCalledWith("SKU-999");
    expect(onClose).toHaveBeenCalled();
  });

  it("supports Manual Entry of custom item name, price, and quantity", () => {
    const onManual = vi.fn();
    const onClose = vi.fn();

    render(
      <UnknownBarcodeDialog
        open={true}
        barcode="CABLE-TEMP-01"
        onClose={onClose}
        onSearchProduct={vi.fn()}
        onManualEntry={onManual}
      />,
    );

    // Click Manual Entry
    fireEvent.click(screen.getByRole("button", { name: /Manual Entry/i }));

    expect(screen.getByText(/Quick Manual Item Entry/i)).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/Universal Adapter Cable/i);
    const priceInput = screen.getByPlaceholderText(/0\.00/i);

    fireEvent.change(nameInput, { target: { value: "Custom AC Cable 2M" } });
    fireEvent.change(priceInput, { target: { value: "850" } });

    fireEvent.click(screen.getByRole("button", { name: /Add to Cart/i }));

    expect(onManual).toHaveBeenCalledWith({
      name: "Custom AC Cable 2M",
      rate: 850,
      qty: 1,
      barcode: "CABLE-TEMP-01",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows permission notice when user lacks create product rights", () => {
    render(
      <UnknownBarcodeDialog
        open={true}
        barcode="SKU-RESTRICTED"
        hasCreatePermission={false}
        onClose={vi.fn()}
        onSearchProduct={vi.fn()}
        onManualEntry={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Create Product/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Create Product is restricted to authorized roles/i)).toBeInTheDocument();
  });
});
