import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
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
  it("uses commercial POS chrome without a second module header stack", () => {
    renderWorkspace("/pos");
    expect(document.querySelector("[data-erp-workspace-layout='pos-terminal']")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "POS / SALES" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "POS / SALES workspace" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("POS navigation")).toBeInTheDocument();
    expect(screen.getByLabelText("POS status")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("POS navigation")).getByRole("link", { name: "POS" })).toHaveAttribute(
      "href",
      "/pos",
    );
    expect(screen.queryByLabelText("ERP modules")).not.toBeInTheDocument();
    expect(screen.getByText("Selected feature")).toBeInTheDocument();
  });

  it("keeps stacked module chrome for non-POS workspaces", () => {
    renderWorkspace("/inventory");
    expect(document.querySelector("[data-erp-workspace-layout='stacked']")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /INVENTORY/i })).toBeInTheDocument();
  });
});
