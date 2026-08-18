import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@electronic-erp/ui";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ExchangePage } from "./ExchangePage";
import { EXCHANGE_STEPS } from "./returns-workspace";

describe("Exchange page", () => {
  it("locks the heading and real exchange workflow without a product-id paste", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <ExchangePage />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Exchange" })).toBeInTheDocument();
    for (const step of EXCHANGE_STEPS) {
      expect(screen.getAllByText(step.label).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText(/Exchange product ID/i)).not.toBeInTheDocument();
  });
});
