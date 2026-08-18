import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@electronic-erp/ui";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ReferencesPage } from "./ReferencesPage";
import { REFERENCE_TABLE_COLUMNS } from "./references-workspace";

describe("References page", () => {
  it("locks the heading and register columns", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <ReferencesPage />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "References" })).toBeInTheDocument();
    for (const col of REFERENCE_TABLE_COLUMNS) {
      expect(screen.getAllByText(col).length).toBeGreaterThan(0);
    }
  });
});
