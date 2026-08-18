import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthContext";
import { POS_IA_TITLES, POS_SHELL_NAV, POS_SHELL_NAV_TITLES, posNavItemForPath, posShellNavItemForPath } from "./pos-ownership";
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

describe("POS environment shell", () => {
  it("renders the dedicated 7-item POS sidebar instead of the 39-module ERP tree", () => {
    renderPos("/pos");
    const nav = screen.getByRole("navigation", { name: "POS navigation" });
    const links = [...nav.querySelectorAll("a")];
    expect(links.map((link) => link.getAttribute("href"))).toEqual(POS_SHELL_NAV.map((item) => item.path));
    expect(links.map((link) => link.textContent?.trim())).toEqual([...POS_SHELL_NAV_TITLES]);
    expect(links.map((link) => link.getAttribute("data-pos-nav"))).toEqual(POS_SHELL_NAV.map((item) => item.icon));
    expect(links.every((link) => link.querySelector("svg[aria-hidden='true']"))).toBe(true);
    expect(screen.queryByLabelText("ERP modules")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "POS navigation" }).querySelector(".pos-nav-group-label")?.textContent).toBe("POS");
    expect(screen.getByLabelText("POS sidebar")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "ERP Home" }).every((link) => link.getAttribute("href") === "/")).toBe(
      true,
    );
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

  it("maps canonical POS routes and aliases onto the terminal sidebar", () => {
    for (const [path, title] of ROUTE_TITLES) {
      expect(posNavItemForPath(path)?.title).toBe(title);
    }
    expect(posShellNavItemForPath("/pos")?.title).toBe("New Sale");
    expect(posShellNavItemForPath("/pos/new")?.title).toBe("New Sale");
    expect(posShellNavItemForPath("/held-sales")?.title).toBe("Hold / Resume");
    expect(posShellNavItemForPath("/discounts")?.title).toBe("Price & Discount");
    expect(posShellNavItemForPath("/invoices")?.title).toBe("Reports");
    expect(posShellNavItemForPath("/pos/salesmen")?.title).toBe("Reports");
    expect(posShellNavItemForPath("/pos/settings")?.title).toBe("Settings");
    const { unmount } = renderPos("/pos/new");
    const posLink = screen.getByRole("link", { name: "New Sale" });
    expect(posLink.className).toContain("pos-nav-active");
    expect(posLink).toHaveAttribute("aria-current", "page");
    unmount();
    renderPos("/exchange");
    const reports = screen.getByRole("link", { name: "Reports" });
    expect(reports.className).toContain("pos-nav-active");
    expect(reports).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Hold / Resume" }).className).not.toContain("pos-nav-active");
    expect(screen.getByRole("link", { name: "Hold / Resume" })).not.toHaveAttribute("aria-current");
  });

  it("moves POS sidebar focus with arrow keys", () => {
    renderPos("/pos");
    const pos = screen.getByRole("link", { name: "New Sale" });
    pos.focus();
    fireEvent.keyDown(pos, { key: "ArrowDown" });
    expect(screen.getByRole("link", { name: "Hold / Resume" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "End" });
    expect(screen.getByRole("link", { name: "Settings" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Home" });
    expect(pos).toHaveFocus();
  });

  it("keeps a compact terminal header", () => {
    renderPos("/pos");
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByLabelText("Branch")).toBeInTheDocument();
    expect(screen.getByLabelText("POS Terminal")).toBeInTheDocument();
    expect(screen.getByLabelText("Cashier")).toBeInTheDocument();
    expect(screen.getByLabelText("Shift Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Date / Time")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Held Sales" })).toHaveAttribute("href", "/held-sales");
    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/notifications");
    expect(screen.getByRole("button", { name: "User" })).toBeInTheDocument();
  });
});
