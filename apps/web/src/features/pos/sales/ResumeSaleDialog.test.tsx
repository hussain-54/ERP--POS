import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ResumeSaleDialog } from "./ResumeSaleDialog";
import { posApi } from "../api";

vi.mock("../api", () => ({
  posApi: {
    listHolds: vi.fn(),
    resumeHold: vi.fn(),
    discardHold: vi.fn(),
  },
  snapshotFromHoldResume: vi.fn((res) => res?.snapshot ?? {}),
}));

describe("ResumeSaleDialog (POS Phase 6 - Real Retail Operations)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders held sales with customer name, items count, total, and timestamp", async () => {
    const mockHeldItems = [
      {
        id: "hold-1",
        holdLabel: "Bilal Electric Store",
        customerName: "Bilal Electric Store",
        notes: "Token #14",
        heldAt: "2026-08-31T10:00:00Z",
        cartSnapshot: {
          customerName: "Bilal Electric Store",
          cart: [
            { name: "Copper Cable 4mm", qty: 2, rate: 1200, discount: 0 },
            { name: "Circuit Breaker 32A", qty: 1, rate: 850, discount: 0 },
          ],
          totals: { grand: 3250 },
        },
      },
    ];

    (posApi.listHolds as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: mockHeldItems,
    });

    render(
      <ResumeSaleDialog
        open={true}
        branchId="branch-1"
        onClose={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Resume Held Sale/i)).toBeInTheDocument();
      expect(screen.getByText(/Bilal Electric Store/i)).toBeInTheDocument();
      expect(screen.getByText(/Token #14/i)).toBeInTheDocument();
      expect(screen.getByText(/3,250.00/i)).toBeInTheDocument();
      expect(screen.getByText(/2 Items/i)).toBeInTheDocument();
      expect(screen.getByText(/Copper Cable 4mm/i)).toBeInTheDocument();
    });
  });

  it("resumes a held sale in one click", async () => {
    const mockHeldItems = [
      {
        id: "hold-2",
        holdLabel: "Walk-in Customer",
        customerName: "Walk-in Customer",
        notes: "Waiting for approval",
        heldAt: "2026-08-31T11:00:00Z",
        cartSnapshot: {
          cart: [{ name: "LED Ceiling Light", qty: 4, rate: 650, discount: 0 }],
          totals: { grand: 2600 },
        },
      },
    ];

    (posApi.listHolds as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: mockHeldItems,
    });
    (posApi.resumeHold as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      snapshot: mockHeldItems[0].cartSnapshot,
    });

    const onResume = vi.fn();
    const onClose = vi.fn();

    render(
      <ResumeSaleDialog
        open={true}
        branchId="branch-1"
        onClose={onClose}
        onResume={onResume}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/LED Ceiling Light/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Resume Sale/i }));

    await waitFor(() => {
      expect(posApi.resumeHold).toHaveBeenCalledWith("hold-2", false);
      expect(onResume).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
