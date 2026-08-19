import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ModuleWorkspace } from "./ModuleWorkspace";

afterEach(() => {
  cleanup();
});

function renderWorkspace(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <ModuleWorkspace>
          <div>Selected feature</div>
        </ModuleWorkspace>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("ModuleWorkspace", () => {
  it("uses one header and context nav for POS without a separate app shell", () => {
    renderWorkspace("/pos");
    expect(screen.getByRole("heading", { name: "POS / SALES" })).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText(/Point of sale, billing, payments/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search sales...")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "POS / SALES workspace" });
    expect(nav).toBeInTheDocument();
    expect(nav.firstElementChild?.className).toContain("overflow-x-auto");
    expect(document.querySelector("[data-erp-workspace-layout='stacked']")).toBeTruthy();
    expect(within(nav).getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/pos");
    expect(within(nav).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Hold / Resume" })).toHaveAttribute("href", "/held-sales");
    expect(within(nav).getByRole("link", { name: "Invoices" })).toHaveAttribute("href", "/invoices");
    expect(within(nav).getByRole("link", { name: "Payments" })).toHaveAttribute("href", "/payments");
    expect(within(nav).getByRole("link", { name: "Returns" })).toHaveAttribute("href", "/returns");
    expect(screen.queryByLabelText("ERP modules")).not.toBeInTheDocument();
    expect(screen.getByText("Selected feature")).toBeInTheDocument();
  });

  it("filters context navigation and highlights the selected POS feature", () => {
    renderWorkspace("/invoices");
    const nav = screen.getByRole("navigation", { name: "POS / SALES workspace" });
    expect(within(nav).getByRole("link", { name: "Invoices" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search POS / SALES" }), {
      target: { value: "invoice" },
    });
    expect(within(nav).getByRole("link", { name: "Invoices" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Hold / Resume" })).not.toBeInTheDocument();
  });
});
