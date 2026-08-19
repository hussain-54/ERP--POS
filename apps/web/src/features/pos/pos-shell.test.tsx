import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthContext";
import {
  POS_IA_TITLES,
  posNavItemForPath,
} from "./pos-ownership";
import { POSShell } from "./design-system/POSShell";

afterEach(() => {
  cleanup();
});

const ROUTE_TITLES: Array<[string, string]> = [
  ["/pos", "New Sale"],
  ["/pos/new", "New Sale"],
  ["/held-sales", "Hold / Resume"],
  ["/invoices", "Invoices"],
  ["/sales-management", "Register"],
  ["/returns", "Returns"],
  ["/exchange", "Exchange"],
  ["/payments", "Payments"],
  ["/discounts", "Discounts"],
  ["/pos/references", "References"],
  ["/pos/salesmen", "Salesmen"],
  ["/pos/installments", "Installments"],
  ["/pos/settings", "Settings"],
];

function renderPos(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <POSShell>
          <div>POS workspace</div>
        </POSShell>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("POS workspace chrome", () => {
  it("keeps POS operational tools without replacing ERP navigation", () => {
    renderPos("/pos");
    expect(screen.queryByLabelText("ERP modules")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("POS navigation")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("POS workspace")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ERP Home" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cash Drawer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close Shift" })).toBeInTheDocument();
    expect(screen.getByText("Opening")).toBeInTheDocument();
    expect(screen.getByText("In Hand")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("Expenses")).toBeInTheDocument();
    expect(screen.getByText("Expected")).toBeInTheDocument();
    expect(screen.getByLabelText("Keyboard shortcuts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /F1/ })).toHaveAttribute("title", "F1 New Sale");
    expect(screen.getByRole("button", { name: /F2/ })).toHaveAttribute("title", "F2 Hold / Resume");
    expect(screen.getByRole("button", { name: /F8/ })).toHaveAttribute("title", "F8 Cancel Sale");
    expect(POS_IA_TITLES).toHaveLength(12);
  });

  it("maps canonical POS routes and aliases onto ownership helpers", () => {
    for (const [path, title] of ROUTE_TITLES) {
      expect(posNavItemForPath(path)?.title).toBe(title);
    }
    expect(posNavItemForPath("/pos")?.title).toBe("New Sale");
    expect(posNavItemForPath("/pos/new")?.title).toBe("New Sale");
    expect(posNavItemForPath("/held-sales")?.title).toBe("Hold / Resume");
    expect(posNavItemForPath("/discounts")?.title).toBe("Discounts");
    expect(posNavItemForPath("/invoices")?.title).toBe("Invoices");
    expect(posNavItemForPath("/pos/salesmen")?.title).toBe("Salesmen");
    expect(posNavItemForPath("/pos/settings")?.title).toBe("Settings");
  });

  it("keeps a compact POS status strip without duplicating ERP chrome", () => {
    renderPos("/pos");
    expect(screen.queryByRole("button", { name: "Menu" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Branch")).not.toBeInTheDocument();
    expect(screen.getByLabelText("POS Terminal")).toBeInTheDocument();
    expect(screen.getByLabelText("Cashier")).toBeInTheDocument();
    expect(screen.getByLabelText("Shift Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Date / Time")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Held Sales" })).toHaveAttribute("href", "/held-sales");
    expect(screen.queryByRole("link", { name: "Notifications" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "User" })).not.toBeInTheDocument();
  });
});
