import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@electronic-erp/ui";
import { ModulePlaceholderPage } from "@/features/modules/ModulePlaceholderPage";
import {
  canShowNavItem,
  ERP_MODULES,
  ERP_NAV_SECTIONS,
  ERP_SIDEBAR_SECTIONS,
  EXTRA_APP_PATHS,
  isPosTerminalPath,
} from "@/app/modules";
import { SidebarNav } from "@/app/shell/SidebarNav";
import { router } from "@/app/router";

describe("web foundation", () => {
  it("renders module placeholder", () => {
    const module = ERP_MODULES.find((m) => m.status === "placeholder") ?? ERP_MODULES[0]!;
    render(
      <MemoryRouter>
        <ToastProvider>
          <ModulePlaceholderPage module={module} />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(module.title)).toBeInTheDocument();
    expect(screen.getAllByText(/Coming Soon/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Module not yet implemented/i)).toBeInTheDocument();
  });

  it("registers major module routes", () => {
    expect(ERP_NAV_SECTIONS).toHaveLength(39);
    expect(ERP_MODULES.length).toBeGreaterThanOrEqual(50);
    expect(ERP_MODULES.some((m) => m.path === "/pos")).toBe(true);
    const sales = ERP_NAV_SECTIONS.find((s) => s.id === "05");
    expect(sales?.title).toBe("Sales");
    expect(sales?.children.map((c) => c.title)).toEqual([
      "New Sale",
      "Hold / Resume",
      "Invoices",
      "Register",
      "Returns",
      "Exchange",
      "Payments",
      "Discounts",
      "References",
      "Salesmen",
      "Installments",
      "Customer / Checkout helpers",
    ]);
    expect(ERP_MODULES.some((m) => m.path === "/held-sales")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/pos/salesmen")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/pos/installments")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/salesman")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/installments")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/credit")).toBe(true);
    expect(isPosTerminalPath("/pos")).toBe(true);
    expect(isPosTerminalPath("/held-sales")).toBe(true);
    expect(isPosTerminalPath("/pos/new")).toBe(true);
    expect(isPosTerminalPath("/pos/salesmen")).toBe(false);
    expect(isPosTerminalPath("/pos/installments")).toBe(false);
    expect(isPosTerminalPath("/invoices")).toBe(false);
    expect(ERP_MODULES.some((m) => m.path === "/hr")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/orders")).toBe(true);
    expect(ERP_MODULES.some((m) => /offline|sqlite|sync center|sync queue/i.test(m.title))).toBe(
      false,
    );
  });
});

describe("nav structure", () => {
  it("gives every module an icon, label, route, parent, and permission", () => {
    const titles = ERP_NAV_SECTIONS.map((s) => s.title);
    expect(new Set(titles).size).toBe(39);
    for (const section of ERP_NAV_SECTIONS) {
      expect(section.icon).toBeTruthy();
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.title).not.toMatch(/page|management system|center$/i);
      expect(section.path).toMatch(/^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/);
      expect(section.permission).toBeTruthy();
      for (const child of section.children) {
        expect(child.title.length).toBeGreaterThan(0);
        expect(child.path.startsWith("/")).toBe(true);
        expect(child.permission).toBeTruthy();
      }
    }
  });

  it("hides repeated parent-path children from the ERP sidebar", () => {
    for (const section of ERP_SIDEBAR_SECTIONS) {
      expect(section.children.some((child) => child.path === section.path)).toBe(false);
    }
    const sales = ERP_SIDEBAR_SECTIONS.find((s) => s.id === "05");
    expect(sales?.children.some((c) => c.title === "Customer / Checkout helpers")).toBe(false);
    expect(sales?.children.some((c) => c.title === "New Sale")).toBe(false);
    for (const section of ERP_SIDEBAR_SECTIONS) {
      const titles = section.children.map((child) => child.title);
      expect(new Set(titles).size).toBe(titles.length);
      const paths = section.children.map((child) => child.path);
      expect(new Set(paths).size).toBe(paths.length);
    }
  });

  it("keeps working duplicate routes registered", () => {
    expect(ERP_MODULES.some((m) => m.path === "/held-sales")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/credit")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/exchange")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/salesman")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/pos/salesmen")).toBe(true);
  });

  it("covers extra deep-link paths used by the router", () => {
    expect(EXTRA_APP_PATHS).toContain("/products/new");
    expect(EXTRA_APP_PATHS).toContain("/pos/new");
    expect(router.routes.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(router.routes);
    for (const path of ["/pos", "/held-sales", "/customers", "/products", "/credit", "/salesman"]) {
      expect(serialized).toContain(path.replace(/^\//, ""));
    }
    expect(serialized).toContain("*");
  });

  it("fails open when no permissions are loaded and closed when they are", () => {
    expect(canShowNavItem("pos.sell", 0, () => false)).toBe(true);
    expect(canShowNavItem("pos.sell", 2, (key) => key === "pos.sell")).toBe(true);
    expect(canShowNavItem("pos.sell", 2, () => false)).toBe(false);
    expect(canShowNavItem(undefined, 2, () => false)).toBe(true);
  });

  it("keeps active and collapsed sidebar usable", () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={["/customers"]}>
        <SidebarNav query="" onNavigate={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("ERP modules")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Customers" })).toHaveAttribute("href", "/customers");
    rerender(
      <MemoryRouter initialEntries={["/customers"]}>
        <SidebarNav query="" onNavigate={() => undefined} collapsed />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("ERP modules")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Collapse Customers/i })).not.toBeInTheDocument();
  });
});
