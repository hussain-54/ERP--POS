import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@electronic-erp/ui";
import { AuthProvider } from "@/features/auth/AuthContext";
import { SalesmenPage } from "./SalesmenPage";
import { SALESMEN_TABLE_COLUMNS } from "./salesman-workspace";

describe("Salesmen page", () => {
  it("locks the heading and roster columns without a UUID field", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <SalesmenPage />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Salesmen" })).toBeInTheDocument();
    for (const col of SALESMEN_TABLE_COLUMNS) {
      expect(screen.getAllByText(col).length).toBeGreaterThan(0);
    }
    expect(screen.queryByLabelText(/user id/i)).not.toBeInTheDocument();
  });
});
