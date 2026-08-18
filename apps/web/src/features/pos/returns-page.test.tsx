import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@electronic-erp/ui";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ReturnsPage } from "./ReturnsPage";
import { RETURN_LINE_COLUMNS, RETURN_STEPS } from "./returns-workspace";

describe("Returns page", () => {
  it("locks the heading, workflow, qty columns, and refund label", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <ReturnsPage />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Returns" })).toBeInTheDocument();
    for (const step of RETURN_STEPS) {
      expect(screen.getAllByText(step.label).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    for (const col of ["Original Qty", "Returned Qty", "Remaining Returnable Qty"]) {
      expect(RETURN_LINE_COLUMNS).toContain(col);
    }
    expect(screen.queryByText("Exchange product ID")).not.toBeInTheDocument();
  });
});
