import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HardwareStatusPill } from "./HardwareStatusPill";

describe("HardwareStatusPill (POS Phase 5 - Scanning & Hardware)", () => {
  it("renders compact hardware pill without cluttering the screen", () => {
    render(<HardwareStatusPill />);
    expect(screen.getByRole("button", { name: /Hardware \(6 Ready\)/i })).toBeInTheDocument();
  });

  it("opens popover with all 6 peripherals on click", () => {
    const onOpenScanner = vi.fn();
    render(<HardwareStatusPill onOpenScanner={onOpenScanner} />);

    fireEvent.click(screen.getByRole("button", { name: /Hardware \(6 Ready\)/i }));

    expect(screen.getByText(/Connected Peripherals/i)).toBeInTheDocument();
    expect(screen.getByText(/Barcode \/ QR Scanner/i)).toBeInTheDocument();
    expect(screen.getByText(/Receipt Printer \(80mm\)/i)).toBeInTheDocument();
    expect(screen.getByText(/A4 Tax Invoice Printer/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Cash Drawer/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Customer Pole Display/i)).toBeInTheDocument();
    expect(screen.getByText(/Payment Terminal \/ Card POS/i)).toBeInTheDocument();

    // Trigger Open Camera Scanner
    fireEvent.click(screen.getByRole("button", { name: /Open Camera Scanner/i }));
    expect(onOpenScanner).toHaveBeenCalled();
  });
});
