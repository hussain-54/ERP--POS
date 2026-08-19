import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@electronic-erp/ui";
import { AuthProvider } from "@/features/auth/AuthContext";
import { PaymentsPage } from "./PaymentsPage";
import { PAYMENT_TABLE_COLUMNS } from "./payment-center";

describe("Payments page", () => {
  it("locks the heading, filters, summary labels, and table columns", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <PaymentsPage />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Payments" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record payment" })).toBeInTheDocument();
    for (const label of ["Recorded", "Pending", "Failed", "Reversed", "Today"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByPlaceholderText("Payment #, invoice #, customer…").className).not.toContain("pos-search-input");
    expect(screen.getByText("Filters")).toBeInTheDocument();
    for (const label of ["Date", "Invoice", "Customer", "Payment Method", "Cashier", "Status", "Branch", "Terminal"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    for (const col of PAYMENT_TABLE_COLUMNS) {
      expect(screen.getAllByText(col).length).toBeGreaterThan(0);
    }
    expect(screen.queryByRole("button", { name: "Reverse" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refund" })).not.toBeInTheDocument();
  });
});
