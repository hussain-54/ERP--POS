import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthContext";
import {
  POS_IA_TITLES,
  POS_TERMINAL_NAV,
  posNavItemForPath,
} from "./pos-ownership";
import { POSShell } from "./design-system/POSShell";

afterEach(() => {
  cleanup();
});

const ROUTE_TITLES: Array<[string, string]> = [
  ["/pos", "POS Terminal"],
  ["/pos/new", "POS Terminal"],
  ["/held-sales", "Resume Sale"],
  ["/pos/resume-sale", "Resume Sale"],
  ["/pos/hold-sale", "Hold Sale"],
  ["/invoices", "Invoices"],
  ["/pos/shift", "POS Shift"],
  ["/sales-management", "POS Shift"],
  ["/returns", "Returns"],
  ["/exchange", "Exchange"],
  ["/payments", "Payments"],
  ["/discounts", "Discounts"],
  ["/pos/salesman-reference", "Salesman / Reference"],
  ["/pos/salesmen", "Salesman / Reference"],
  ["/pos/installments", "Installments"],
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
  it("keeps POS operational tools inside the ERP workspace without a second app shell", () => {
    renderPos("/pos");
    expect(screen.queryByLabelText("ERP modules")).not.toBeInTheDocument();
    expect(screen.getByLabelText("POS navigation")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: /F6/ })).toHaveAttribute("title", "F6 Recalculate");
    expect(screen.getByRole("button", { name: /F8/ })).toHaveAttribute("title", "F8 Cancel Sale");
    expect(POS_IA_TITLES).toHaveLength(26);
    expect(POS_TERMINAL_NAV.map((item) => item.label)).toEqual([
      "POS",
      "Hold / Resume",
      "Customers",
      "Products",
      "Price & Discount",
      "Reports",
      "Settings",
    ]);
    expect(POS_TERMINAL_NAV.map((item) => item.path)).toEqual([
      "/pos",
      "/pos/resume-sale",
      "/pos/customer-selection",
      "/pos/product-search",
      "/discounts",
      "/pos/reports",
      "/pos/settings",
    ]);
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
  });

  it("maps canonical POS routes and aliases onto ownership helpers", () => {
    for (const [path, title] of ROUTE_TITLES) {
      expect(posNavItemForPath(path)?.title, path).toBe(title);
    }
    expect(posNavItemForPath("/pos")?.title).toBe("POS Terminal");
    expect(posNavItemForPath("/pos/new")?.title).toBe("POS Terminal");
    expect(posNavItemForPath("/held-sales")?.title).toBe("Resume Sale");
    expect(posNavItemForPath("/discounts")?.title).toBe("Discounts");
    expect(posNavItemForPath("/invoices")?.title).toBe("Invoices");
    expect(posNavItemForPath("/pos/salesmen")?.title).toBe("Salesman / Reference");
    expect(posNavItemForPath("/pos/settings")?.title).toBeUndefined();
  });

  it("keeps a compact POS status strip with branch, terminal, cashier, and shift", () => {
    renderPos("/pos");
    expect(screen.getByLabelText("POS Branch")).toBeInTheDocument();
    expect(screen.getByLabelText("POS Terminal")).toBeInTheDocument();
    expect(screen.getByLabelText("Cashier")).toBeInTheDocument();
    expect(screen.getByLabelText("Shift Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Date / Time")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Held Sales" })).toHaveAttribute("href", "/pos/resume-sale");
    expect(screen.getByRole("link", { name: "POS Notifications" })).toHaveAttribute("href", "/notifications");
    expect(screen.getByLabelText("POS User")).toBeInTheDocument();
  });
});
