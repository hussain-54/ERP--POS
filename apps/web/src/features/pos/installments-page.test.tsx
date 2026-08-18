import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@electronic-erp/ui";
import { AuthProvider } from "@/features/auth/AuthContext";
import { InstallmentsPage } from "./InstallmentsPage";
import { INSTALLMENT_LINE_COLUMNS, INSTALLMENT_PLAN_COLUMNS } from "./installments-workspace";

describe("Installments page", () => {
  it("locks the heading, plan columns, and detail columns without UUID paste fields", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <InstallmentsPage />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Installments" })).toBeInTheDocument();
    for (const col of INSTALLMENT_PLAN_COLUMNS) {
      expect(screen.getAllByText(col).length).toBeGreaterThan(0);
    }
    for (const col of INSTALLMENT_LINE_COLUMNS) {
      expect(screen.getAllByText(col).length).toBeGreaterThan(0);
    }
    expect(screen.queryByLabelText(/customer id/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Customer")).toBeInTheDocument();
    expect(screen.getByLabelText("Invoice")).toBeInTheDocument();
  });
});
