import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
  it("uses stacked module chrome for POS placeholder", () => {
    renderWorkspace("/pos");
    expect(document.querySelector("[data-erp-workspace-layout='stacked']")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "POS / SALES" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "POS / SALES workspace" })).toBeInTheDocument();
    expect(screen.queryByLabelText("POS navigation")).not.toBeInTheDocument();
    expect(screen.getByText("Selected feature")).toBeInTheDocument();
  });

  it("keeps stacked module chrome for non-POS workspaces", () => {
    renderWorkspace("/inventory");
    expect(document.querySelector("[data-erp-workspace-layout='stacked']")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /INVENTORY/i })).toBeInTheDocument();
  });
});
