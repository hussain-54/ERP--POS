import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@electronic-erp/ui";
import { AuthProvider } from "@/features/auth/AuthContext";
import { InvoicesPage } from "./InvoicesPage";
import { INVOICE_TABLE_COLUMNS, SALE_KPI_CARDS, SALE_TABS } from "./sales-workspace";

describe("Sales Dashboard", () => {
  it("locks the breadcrumb, KPIs, filters, tabs, and table columns", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <InvoicesPage />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Sales Management" })).toHaveAttribute("href", "/pos/reports");
    expect(screen.getByRole("heading", { name: "Sales Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search by invoice #, customer, phone, SKU…")).toBeInTheDocument();
    expect(screen.getByText("Date Range")).toBeInTheDocument();
    for (const label of ["Customer", "Cashier", "Salesman", "Payment Method"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.queryByRole("combobox", { name: "Branch" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "More Filters" }));
    for (const label of ["Status", "Branch", "Terminal"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    for (const card of SALE_KPI_CARDS) {
      expect(screen.getByText(card.label)).toBeInTheDocument();
    }
    for (const tab of SALE_TABS) {
      expect(screen.getByRole("tab", { name: tab.label })).toBeInTheDocument();
    }
    for (const col of INVOICE_TABLE_COLUMNS) {
      expect(screen.getAllByText(col).length).toBeGreaterThan(0);
    }
  });
});
