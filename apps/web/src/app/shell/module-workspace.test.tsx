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
          <div data-testid="pos-workspace-child">Selected feature</div>
        </ModuleWorkspace>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("ModuleWorkspace", () => {
  it("uses POS workspace chrome for POS routes", () => {
    renderWorkspace("/pos");
    expect(document.querySelector("[data-erp-workspace-layout='pos-workspace']")).toBeTruthy();
    expect(screen.getByLabelText("POS navigation")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "POS / SALES" })).not.toBeInTheDocument();
    expect(screen.getByTestId("pos-workspace-child")).toBeInTheDocument();
  });

  it("keeps stacked module chrome for non-POS workspaces", () => {
    renderWorkspace("/inventory");
    expect(document.querySelector("[data-erp-workspace-layout='stacked']")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /INVENTORY/i })).toBeInTheDocument();
  });
});
