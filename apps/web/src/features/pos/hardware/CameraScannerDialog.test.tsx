import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CameraScannerDialog } from "./CameraScannerDialog";

describe("CameraScannerDialog (POS Phase 5 - Scanning & Hardware)", () => {
  it("renders Camera & QR Scanner modal with viewfinder and test buttons", () => {
    const onScan = vi.fn();
    const onClose = vi.fn();

    render(
      <CameraScannerDialog
        open={true}
        onClose={onClose}
        onScan={onScan}
      />,
    );

    expect(screen.getByText(/Camera & QR Scanner/i)).toBeInTheDocument();
    expect(screen.getByText(/Point camera at 1D barcode or 2D QR code on product/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Torch/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Flip/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AC-1\.5T \(Barcode\)/i })).toBeInTheDocument();
  });

  it("triggers onScan when a quick test barcode is clicked", () => {
    const onScan = vi.fn();
    const onClose = vi.fn();

    render(
      <CameraScannerDialog
        open={true}
        onClose={onClose}
        onScan={onScan}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /AC-1\.5T \(Barcode\)/i }));
    expect(onScan).toHaveBeenCalledWith("ORI-INV-15T");
    expect(onClose).toHaveBeenCalled();
  });
});
