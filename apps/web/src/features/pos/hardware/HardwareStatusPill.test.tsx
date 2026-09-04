import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HardwareStatusPill } from "./HardwareStatusPill";

describe("HardwareStatusPill (POS Phase 5 - Scanning & Hardware)", () => {
  it("renders compact hardware pill from live statuses", () => {
    render(<HardwareStatusPill />);
    expect(screen.getByRole("button", { name: /Hardware \(/i })).toBeInTheDocument();
  });

  it("opens popover with live peripheral statuses", () => {
    const onOpenScanner = vi.fn();
    render(<HardwareStatusPill onOpenScanner={onOpenScanner} />);

    fireEvent.click(screen.getByRole("button", { name: /Hardware \(/i }));

    expect(screen.getByText(/Peripherals/i)).toBeInTheDocument();
    expect(screen.getByText(/Barcode Scanner/i)).toBeInTheDocument();
    expect(screen.getByText(/Receipt Printer/i)).toBeInTheDocument();
    expect(screen.getByText("Cash Drawer")).toBeInTheDocument();
    expect(screen.getByText("Camera")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Open Camera Scanner/i }));
    expect(onOpenScanner).toHaveBeenCalled();
  });
});
