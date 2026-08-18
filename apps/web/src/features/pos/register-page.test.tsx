import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@electronic-erp/ui";
import { AuthProvider } from "@/features/auth/AuthContext";
import { RegisterPage } from "./RegisterPage";
import { REGISTER_METRIC_LABELS } from "./register-shift";

describe("Register page", () => {
  it("locks the heading, shift metrics, and supported actions", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Register" })).toBeInTheDocument();
    for (const label of REGISTER_METRIC_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Open Shift" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close Shift" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cash Count" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconcile" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cash In" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cash Out" })).not.toBeInTheDocument();
  });
});
