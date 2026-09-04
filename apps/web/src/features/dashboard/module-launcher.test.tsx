import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ERP_STABLE_PARENT_PATHS } from "@/app/modules";
import { ModuleLauncherPage } from "./ModuleLauncherPage";
import { launcherModules } from "./module-launcher";

afterEach(() => {
  cleanup();
});

function renderLauncher(path = "/command-center") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/command-center" element={<ModuleLauncherPage />} />
          <Route path="/" element={<ModuleLauncherPage />} />
          <Route path="/pos" element={<div>POS workspace</div>} />
          <Route path="/invoices" element={<div>Invoices workspace</div>} />
          <Route path="/warehouse" element={<div>Warehouse workspace</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("ModuleLauncherPage", () => {
  it("renders one card per registry module and opens POS inside routing", () => {
    renderLauncher();
    const cards = screen.getAllByRole("link", { name: /Enter Module/i });
    expect(cards).toHaveLength(39);
    expect(cards.map((card) => card.getAttribute("href"))).toEqual([...ERP_STABLE_PARENT_PATHS]);
    expect(cards.map((card) => card.getAttribute("data-launcher-module"))).toEqual(
      launcherModules().map((module) => module.id),
    );

    const grid = document.querySelector("[data-launcher-grid]");
    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("sm:grid-cols-2");
    expect(grid?.className).toContain("lg:grid-cols-3");
    expect(grid?.className).toContain("xl:grid-cols-4");

    expect(screen.getByText("#02")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: /Command Center/i })).toBeInTheDocument();
    expect(screen.getByText("POS / SALES")).toBeInTheDocument();
    expect(screen.getAllByText("Enter Module")).toHaveLength(39);

    fireEvent.click(screen.getByRole("link", { name: /POS \/ SALES/i }));
    expect(screen.getByText("POS workspace")).toBeInTheDocument();
  });

  it("searches module names, numbers, and child features", () => {
    renderLauncher();
    const search = screen.getByRole("searchbox", { name: "Search modules" });

    fireEvent.change(search, { target: { value: "invoice" } });
    const invoiceResults = screen.getByRole("list", { name: "Module search results" });
    const invoice = within(invoiceResults).getByRole("link", { name: /Invoices/i });
    expect(invoice).toHaveAttribute("href", "/pos/invoices");
    expect(within(invoiceResults).getByText(/02 POS \/ SALES/i)).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "warehouse" } });
    const warehouseResults = screen.getByRole("list", { name: "Module search results" });
    expect(within(warehouseResults).getByRole("link")).toHaveAttribute("href", "/warehouse");
    expect(within(warehouseResults).getByText(/06 WAREHOUSE \/ WMS/i)).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "02" } });
    const numberResults = screen.getByRole("list", { name: "Module search results" });
    expect(within(numberResults).getByRole("link")).toHaveAttribute("href", "/pos");
    expect(within(numberResults).getByText(/02 POS \/ SALES/i)).toBeInTheDocument();
  });
});
