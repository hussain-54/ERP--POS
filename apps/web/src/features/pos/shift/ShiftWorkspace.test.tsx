import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ShiftWorkspace } from "./ShiftWorkspace";
import { posApi } from "../api";
import { ShiftSummaryModal } from "./ShiftSummaryModal";

vi.mock("../api", () => ({
  posApi: {
    currentShift: vi.fn(),
    openShift: vi.fn(),
    closeShift: vi.fn(),
    postCashMovement: vi.fn(),
    listCashMovements: vi.fn(),
    searchSalesManagement: vi.fn(),
  },
}));

vi.mock("@electronic-erp/ui", async () => {
  const actual = await vi.importActual("@electronic-erp/ui");
  return {
    ...actual,
    useToast: () => ({
      push: vi.fn(),
      dismiss: vi.fn(),
    }),
  };
});

vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({
    branchId: "branch-1",
    organizationId: "org-1",
    user: { fullName: "Asad Mehmood" },
    hasPermission: () => true,
  }),
}));

describe("ShiftWorkspace (POS Phase 7 - Shift & Cash Control)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Open Shift view with opening cash input, float presets, and confirmation prompt", async () => {
    (posApi.currentShift as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      item: null,
    });
    (posApi.openShift as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "shift-1",
    });

    render(
      <MemoryRouter>
        <ShiftWorkspace mode="open" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Open Cashier Shift/i)).toBeInTheDocument();
      expect(screen.getByText(/Opening Cash \(Float\)/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Rs\. 5,000\.00/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Rs\. 10,000\.00/i })).toBeInTheDocument();
    });

    // Pick 5,000 preset
    fireEvent.click(screen.getByRole("button", { name: /Rs\. 5,000\.00/i }));

    // Click Confirm & Open Shift
    fireEvent.click(screen.getByRole("button", { name: /Confirm & Open Shift/i }));

    // Check confirmation prompt modal
    expect(screen.getByText(/Confirm Shift Opening/i)).toBeInTheDocument();
    expect(screen.getAllByText(/5,000\.00/i).length).toBeGreaterThanOrEqual(1);

    // Confirm Start
    fireEvent.click(screen.getByRole("button", { name: /Confirm & Start/i }));

    await waitFor(() => {
      expect(posApi.openShift).toHaveBeenCalledWith({
        branchId: "branch-1",
        openingFloat: 5000,
        notes: undefined,
      });
    });
  });

  it("renders Current Shift with 8 metrics: Opening Cash, Cash Sales, Card Sales, Wallet Sales, Cash In, Cash Out, Expenses, and Expected Cash", async () => {
    const mockShift = {
      id: "shift-100",
      status: "open",
      opening_float: 5000,
      expected_cash: 18500,
      sales_total: 25000,
      cash_sales_total: 15000,
      expense_total: 1500,
      opened_at: new Date(Date.now() - 7200000).toISOString(),
    };

    const mockMovements = [
      { id: "mov-1", kind: "cash_in", amount: 1000, reason: "Float added" },
      { id: "mov-2", kind: "cash_out", amount: 2500, reason: "Store expense tea & cleaning" },
    ];

    const mockSales = [
      { id: "sale-1", grandTotal: 15000, paidTotal: 15000, paymentMethods: "Cash" },
      { id: "sale-2", grandTotal: 6000, paidTotal: 6000, paymentMethods: "Card" },
      { id: "sale-3", grandTotal: 4000, paidTotal: 4000, paymentMethods: "JazzCash" },
    ];

    (posApi.currentShift as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      item: mockShift,
    });
    (posApi.listCashMovements as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: mockMovements,
    });
    (posApi.searchSalesManagement as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: mockSales,
    });

    render(
      <MemoryRouter>
        <ShiftWorkspace mode="dashboard" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Active Cashier Shift/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Opening Cash/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Cash Sales/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Card Sales/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Wallet Sales/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Cash In/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Cash Out/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Expenses/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Expected Cash/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("handles Close Shift reconciliation with Expected vs Actual Cash, difference calculation, and confirmation", async () => {
    const mockShift = {
      id: "shift-200",
      status: "open",
      opening_float: 5000,
      expected_cash: 20000,
      sales_total: 15000,
      cash_sales_total: 15000,
      expense_total: 0,
      opened_at: new Date(Date.now() - 3600000).toISOString(),
    };

    (posApi.currentShift as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      item: mockShift,
    });
    (posApi.listCashMovements as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [],
    });
    (posApi.searchSalesManagement as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [],
    });
    (posApi.closeShift as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "shift-200",
      status: "closed",
    });

    render(
      <MemoryRouter>
        <ShiftWorkspace mode="close" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Shift Reconciliation & Closing/i)).toBeInTheDocument();
      expect(screen.getByText(/Expected Cash in Drawer/i)).toBeInTheDocument();
    });

    const countedInput = screen.getByPlaceholderText(/0\.00/i);
    fireEvent.change(countedInput, { target: { value: "20500" } });

    expect(screen.getByText(/Cash Surplus \(Over\)/i)).toBeInTheDocument();
    expect(screen.getByText(/\+Rs\. 500\.00/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Proceed to Close Shift/i }));

    expect(screen.getByText(/Confirm Shift Finalization/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Confirm & Close Shift/i }));

    await waitFor(() => {
      expect(posApi.closeShift).toHaveBeenCalledWith("shift-200", {
        closingCounted: 20500,
        notes: undefined,
      });
    });
  });

  it("renders ShiftSummaryModal with full 8-point financial breakdown and print trigger", () => {
    const mockSummary = {
      shiftId: "shift-abc-123456",
      branchName: "Main Branch",
      cashierName: "Asad Mehmood",
      terminalId: "Counter 1",
      openedAt: "2026-08-31T09:00:00Z",
      closedAt: "2026-08-31T17:00:00Z",
      duration: "8h 0m",
      openingCash: 5000,
      cashSales: 35000,
      cardSales: 12000,
      walletSales: 8000,
      totalSales: 55000,
      cashIn: 2000,
      cashOut: 1000,
      expenses: 500,
      expectedCash: 41000,
      actualCash: 41000,
      difference: 0,
      notes: "Shift closed with exact balance",
      movementsCount: 3,
      salesCount: 15,
    };

    render(
      <ShiftSummaryModal
        open={true}
        data={mockSummary}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/Shift Closing Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Asad Mehmood/i)).toBeInTheDocument();
    expect(screen.getByText(/Opening Cash \(Float\)/i)).toBeInTheDocument();
    expect(screen.getByText(/35,000\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/12,000\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/8,000\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/Print Shift Summary \(80mm Thermal\)/i)).toBeInTheDocument();
  });
});
