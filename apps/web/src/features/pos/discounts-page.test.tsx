import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@electronic-erp/ui";
import { AuthProvider } from "@/features/auth/AuthContext";
import { DiscountsPage } from "./DiscountsPage";
import { DISCOUNT_TABLE_COLUMNS } from "./discounts-workspace";

describe("Discounts page", () => {
  it("locks the heading, policy columns, and approval workflow without a sale grand total", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <DiscountsPage />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Discounts" })).toBeInTheDocument();
    for (const col of DISCOUNT_TABLE_COLUMNS) {
      expect(screen.getAllByText(col).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("Line discount — percentage")).toBeInTheDocument();
    expect(screen.getByText("Invoice discount — fixed amount")).toBeInTheDocument();
    expect(screen.getAllByText("Price Override").length).toBeGreaterThan(0);
    expect(screen.getByText("Never bypassed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request approval" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Approval workflow" })).toBeInTheDocument();
    expect(screen.queryByText("GRAND TOTAL")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve override" })).not.toBeInTheDocument();
  });
});
