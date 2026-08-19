import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@electronic-erp/ui";
import { AuthProvider } from "@/features/auth/AuthContext";
import { HOLD_TABS, HOLD_TABLE_COLUMNS } from "./held-sales";
import { HeldSalesPage } from "./HeldSalesPage";

describe("Hold / Resume Sale page", () => {
  it("locks the heading, primary action, stats, tabs, and table columns", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <HeldSalesPage />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Hold / Resume Sale" })).toBeInTheDocument();
    expect(screen.getByText("Manage your held sales, resume or delete holds.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Hold Current Sale" })).toBeInTheDocument();
    expect(screen.getAllByText("Active Holds").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Expiring Soon").length).toBeGreaterThan(0);
    expect(screen.getByText("Expired Holds")).toBeInTheDocument();
    expect(screen.getAllByText("Today's Holds").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Your Holds").length).toBeGreaterThan(0);
    expect(screen.getByText("Total Held Value")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search by hold #, customer, cashier...")).toBeInTheDocument();
    expect(screen.getByText("Filters")).toBeInTheDocument();
    expect(screen.getByLabelText("Filters")).toBeInTheDocument();
    for (const tab of HOLD_TABS) {
      expect(screen.getByRole("tab", { name: tab.label })).toBeInTheDocument();
    }
    for (const col of HOLD_TABLE_COLUMNS) {
      expect(screen.getByText(col)).toBeInTheDocument();
    }
  });
});
