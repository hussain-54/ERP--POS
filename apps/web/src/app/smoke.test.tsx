import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@electronic-erp/ui";
import { ModulePlaceholderPage } from "@/features/modules/ModulePlaceholderPage";
import {
  canShowNavItem,
  DUPLICATE_ROUTE_PAIRS,
  ERP_FEATURE_FOLDERS,
  ERP_MODULES,
  ERP_NAV_SECTIONS,
  ERP_SIDEBAR_SECTIONS,
  EXTRA_APP_PATHS,
  isComingSoonEngineSection,
  isPosEnvironmentPath,
  isPosTerminalPath,
  isSystemAdminPath,
  resolveShellHeader,
} from "@/app/modules";
import { POS_IA_TITLES, POS_SHELL_NAV, POS_SHELL_NAV_TITLES } from "@/features/pos/pos-ownership";
import { AppShell } from "@/app/shell/AppShell";
import { SidebarNav } from "@/app/shell/SidebarNav";
import { AuthProvider } from "@/features/auth/AuthContext";
import { SystemAdminLayout } from "@/features/system/SystemAdminLayout";
import { SystemAdminHome } from "@/features/system/SystemAdminHome";
import { IMPLEMENTED_ROUTES, router } from "@/app/router";

afterEach(() => {
  cleanup();
});

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
      "Settings",
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
    expect(isPosEnvironmentPath("/pos")).toBe(true);
    expect(isPosEnvironmentPath("/invoices")).toBe(true);
    expect(isPosEnvironmentPath("/sales-management")).toBe(true);
    expect(isPosEnvironmentPath("/pos/salesmen")).toBe(true);
    expect(isPosEnvironmentPath("/pos/settings")).toBe(true);
    expect(isPosEnvironmentPath("/salesman")).toBe(false);
    expect(isPosEnvironmentPath("/installments")).toBe(false);
    expect(isPosEnvironmentPath("/credit")).toBe(false);
    expect(isPosEnvironmentPath("/settings/pos")).toBe(false);
    expect(ERP_MODULES.some((m) => m.path === "/hr")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/orders")).toBe(true);
    expect(ERP_MODULES.some((m) => /offline|sqlite|sync center|sync queue/i.test(m.title))).toBe(
      false,
    );
  });
});

describe("39-module navigation lock", () => {
  const LOCKED_PARENTS = [
    { id: "01", masterTitle: "Dashboard", title: "Dashboard", path: "/" },
    { id: "02", masterTitle: "Product Management", title: "Products", path: "/products" },
    { id: "03", masterTitle: "Barcode & QR", title: "Barcodes", path: "/barcodes" },
    { id: "04", masterTitle: "AI Camera Product Recognition", title: "AI Camera", path: "/ai-camera" },
    { id: "05", masterTitle: "POS / Sales", title: "Sales", path: "/pos" },
    { id: "06", masterTitle: "Quotations", title: "Quotations", path: "/quotations" },
    { id: "07", masterTitle: "Orders", title: "Orders", path: "/orders" },
    { id: "08", masterTitle: "Delivery", title: "Delivery", path: "/deliveries" },
    { id: "09", masterTitle: "Purchases", title: "Purchases", path: "/purchases" },
    { id: "10", masterTitle: "Inventory", title: "Inventory", path: "/inventory" },
    { id: "11", masterTitle: "Warehouses", title: "Warehouses", path: "/warehouses" },
    { id: "12", masterTitle: "Customers", title: "Customers", path: "/customers" },
    { id: "13", masterTitle: "Suppliers", title: "Suppliers", path: "/suppliers" },
    { id: "14", masterTitle: "Service & Repair", title: "Service", path: "/service" },
    { id: "15", masterTitle: "Warranty", title: "Warranty", path: "/warranty" },
    { id: "16", masterTitle: "Accounts", title: "Accounts", path: "/accounts" },
    { id: "17", masterTitle: "Banking", title: "Banking", path: "/banking" },
    { id: "18", masterTitle: "CRM & Marketing", title: "CRM", path: "/crm" },
    { id: "19", masterTitle: "Reports & Analytics", title: "Reports", path: "/reports" },
    { id: "20", masterTitle: "Salesman / Field Sales", title: "Salesmen", path: "/salesman" },
    { id: "21", masterTitle: "Expenses", title: "Expenses", path: "/expenses" },
    { id: "22", masterTitle: "Installments", title: "Installments", path: "/installments" },
    { id: "23", masterTitle: "Loyalty", title: "Loyalty", path: "/loyalty" },
    { id: "24", masterTitle: "Documents", title: "Documents", path: "/documents" },
    { id: "25", masterTitle: "Approval Workflow", title: "Approvals", path: "/approvals" },
    { id: "26", masterTitle: "Users & Role Management", title: "Users", path: "/users" },
    { id: "27", masterTitle: "Permissions", title: "Permissions", path: "/permissions" },
    { id: "28", masterTitle: "Audit Trail", title: "Audit", path: "/audit" },
    { id: "29", masterTitle: "Notification Center", title: "Notifications", path: "/notifications" },
    { id: "30", masterTitle: "Multi-Branch", title: "Branches", path: "/branches" },
    { id: "31", masterTitle: "Tax & Pakistan Compliance", title: "Tax", path: "/tax" },
    { id: "32", masterTitle: "Import / Export", title: "Import / Export", path: "/import-export" },
    { id: "33", masterTitle: "Printing", title: "Printing", path: "/printing" },
    { id: "34", masterTitle: "Backup & Disaster Recovery", title: "Backup", path: "/backup" },
    { id: "35", masterTitle: "Devices / Printing", title: "Devices", path: "/devices" },
    { id: "36", masterTitle: "Industry Engine", title: "Industry", path: "/industry-engine" },
    { id: "37", masterTitle: "Customization Engine", title: "Customization", path: "/customization-engine" },
    { id: "38", masterTitle: "Rules / Automation Engine", title: "Automation", path: "/rules-engine" },
    { id: "39", masterTitle: "System Administration", title: "System", path: "/settings" },
  ] as const;

  it("locks exactly 39 top-level parents with official names and short labels", () => {
    expect(ERP_NAV_SECTIONS).toHaveLength(39);
    expect(ERP_NAV_SECTIONS.map((s) => s.id)).toEqual(LOCKED_PARENTS.map((p) => p.id));
    for (const [index, expected] of LOCKED_PARENTS.entries()) {
      const section = ERP_NAV_SECTIONS[index];
      expect(section).toMatchObject(expected);
    }
  });

  it("keeps B2B under Orders, AI Insights under Reports, and System children under module 39", () => {
    const orders = ERP_NAV_SECTIONS.find((s) => s.id === "07");
    expect(orders?.children.some((c) => c.title === "B2B" && c.path === "/b2b")).toBe(true);

    const reports = ERP_NAV_SECTIONS.find((s) => s.id === "19");
    expect(reports?.children.some((c) => c.title === "AI Insights" && c.path === "/ai-insights")).toBe(
      true,
    );

    const system = ERP_NAV_SECTIONS.find((s) => s.id === "39");
    expect(system?.path).toBe("/settings");
    expect(system?.children.length).toBeGreaterThan(0);
    expect(ERP_NAV_SECTIONS.filter((s) => s.children.some((c) => c.path === "/hr")).map((s) => s.id)).toEqual(
      ["39"],
    );
  });

  it("keeps Salesmen and Installments as modules 20 and 22 while preserving Sales shortcuts", () => {
    const sales = ERP_NAV_SECTIONS.find((s) => s.id === "05");
    const salesmen = ERP_NAV_SECTIONS.find((s) => s.id === "20");
    const installments = ERP_NAV_SECTIONS.find((s) => s.id === "22");

    expect(salesmen?.path).toBe("/salesman");
    expect(installments?.path).toBe("/installments");
    expect(sales?.children.some((c) => c.title === "Salesmen" && c.path === "/pos/salesmen")).toBe(true);
    expect(sales?.children.some((c) => c.title === "Installments" && c.path === "/pos/installments")).toBe(
      true,
    );
  });

  it("locks child navigation titles under each parent", () => {
    const titles = (id: string) =>
      ERP_NAV_SECTIONS.find((s) => s.id === id)?.children.map((c) => c.title);
    expect(titles("01")).toEqual(["Dashboard"]);
    expect(titles("02")).toEqual([
      "Products",
      "New Product",
      "Categories",
      "Subcategories",
      "Brands",
      "Companies",
      "Units",
      "Pricing",
      "Variants",
      "Attributes",
      "Media",
      "Specifications",
    ]);
    expect(titles("03")).toEqual(["Barcodes", "QR"]);
    expect(titles("04")).toEqual(["AI Camera"]);
    expect(titles("05")).toEqual([
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
      "Settings",
    ]);
    expect(titles("06")).toEqual(["Quotations"]);
    expect(titles("07")).toEqual(["Orders", "B2B"]);
    expect(titles("08")).toEqual(["Delivery"]);
    expect(titles("09")).toEqual(["Purchases", "Returns", "Automation"]);
    expect(titles("10")).toEqual([
      "Inventory",
      "Movements",
      "Batches",
      "Serials",
      "Expiry",
      "Adjustments",
      "Damaged",
      "Counts",
    ]);
    expect(titles("11")).toEqual([
      "Warehouses",
      "Racks",
      "Shelves",
      "Bins",
      "Receiving",
      "Dispatch",
      "Transfers",
    ]);
    expect(titles("12")).toEqual(["Customers", "Ledger", "Receivables", "Credit", "History"]);
    expect(titles("13")).toEqual(["Suppliers", "Ledger", "Payables", "Price Lists", "Performance"]);
    expect(titles("14")).toEqual(["Service", "Complaints", "Technicians", "Repairs", "Charges"]);
    expect(titles("15")).toEqual(["Warranty", "Replacements", "History"]);
    expect(titles("16")).toEqual(["Accounts", "Cash", "Journals", "Receipts", "P&L"]);
    expect(titles("17")).toEqual(["Banking"]);
    expect(titles("18")).toEqual(["CRM", "Campaigns", "SMS", "WhatsApp", "Marketing", "Engagement"]);
    expect(titles("19")).toEqual(["Reports", "BI", "AI Insights"]);
    expect(titles("20")).toEqual(["Salesmen", "References", "Commissions"]);
    expect(titles("21")).toEqual(["Expenses", "Period Reports"]);
    expect(titles("22")).toEqual(["Installments"]);
    expect(titles("23")).toEqual(["Loyalty", "Offers", "Redeem"]);
    expect(titles("24")).toEqual(["Documents"]);
    expect(titles("25")).toEqual(["Approvals"]);
    expect(titles("26")).toEqual(["Users", "Roles"]);
    expect(titles("27")).toEqual(["Permissions", "User Overrides"]);
    expect(titles("28")).toEqual(["Audit"]);
    expect(titles("29")).toEqual(["Notifications"]);
    expect(titles("30")).toEqual(["Branches", "Membership"]);
    expect(titles("31")).toEqual(["Tax", "Rates", "Tax Reports"]);
    expect(titles("32")).toEqual(["Import", "Export", "Templates"]);
    expect(titles("33")).toEqual(["Printing", "Print Queue", "Preview"]);
    expect(titles("34")).toEqual(["Backup", "Restore Points"]);
    expect(titles("35")).toEqual(["Devices", "Cash Drawer", "Device Events"]);
    expect(titles("36")).toEqual(["Coming Soon"]);
    expect(titles("37")).toEqual(["Coming Soon"]);
    expect(titles("38")).toEqual(["Automation", "Transaction Linking", "Rules"]);
    expect(titles("39")).toEqual([
      "Company",
      "Localization",
      "Currency",
      "Language",
      "Date & Numbering",
      "Numbering",
      "Templates",
      "Barcode",
      "POS",
      "Email",
      "SMS",
      "Storage",
      "Logs",
      "Maintenance",
      "Security",
      "Integrations",
      "Store",
      "Mobile",
      "HR",
    ]);
  });

  it("keeps modules 36–38 as Coming Soon placeholders", () => {
    for (const id of ["36", "37", "38"]) {
      const section = ERP_NAV_SECTIONS.find((s) => s.id === id);
      const route = ERP_MODULES.find((m) => m.path === section?.path);
      expect(route?.status).toBe("placeholder");
      expect(isComingSoonEngineSection(section!)).toBe(true);
    }
    expect(isComingSoonEngineSection({ id: "39" })).toBe(false);
    expect(isComingSoonEngineSection({ id: "05" })).toBe(false);
  });

  it("locks frontend feature folder names without inventing 36–38 folders", () => {
    expect(ERP_FEATURE_FOLDERS).toHaveLength(39);
    expect(ERP_FEATURE_FOLDERS.map((row) => row.id)).toEqual(ERP_NAV_SECTIONS.map((s) => s.id));
    expect(ERP_FEATURE_FOLDERS.map((row) => row.folder)).toEqual([
      "dashboard",
      "product-management",
      "barcode-qr",
      "ai-camera",
      "pos",
      "quotations",
      "orders",
      "delivery",
      "purchases",
      "inventory",
      "warehouses",
      "customers",
      "suppliers",
      "service-repair",
      "warranty",
      "accounts",
      "banking",
      "crm",
      "reports",
      "salesman",
      "expenses",
      "installments",
      "loyalty",
      "documents",
      "approvals",
      "users",
      "permissions",
      "audit",
      "notifications",
      "branches",
      "tax",
      "import-export",
      "printing",
      "backup",
      "devices",
      null,
      null,
      null,
      "system",
    ]);
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

  it("shows nested children under each parent without extra master modules", () => {
    const visible = (id: string) =>
      ERP_SIDEBAR_SECTIONS.find((s) => s.id === id)?.children.map((c) => c.title);
    expect(visible("01")).toEqual([]);
    expect(visible("02")).toEqual([
      "New Product",
      "Categories",
      "Subcategories",
      "Brands",
      "Companies",
      "Units",
      "Pricing",
      "Variants",
      "Attributes",
      "Media",
      "Specifications",
    ]);
    expect(visible("05")).toEqual([
      "Hold / Resume",
      "Invoices",
      "Register",
      "Returns",
      "Payments",
      "Discounts",
      "Settings",
    ]);
    expect(visible("07")).toEqual(["B2B"]);
    expect(visible("09")).toEqual(["Returns", "Automation"]);
    expect(visible("10")).toEqual([
      "Movements",
      "Batches",
      "Serials",
      "Expiry",
      "Adjustments",
      "Damaged",
      "Counts",
    ]);
    expect(visible("21")).toEqual(["Period Reports"]);
    expect(visible("23")).toEqual(["Offers", "Redeem"]);
    expect(visible("26")).toEqual(["Roles"]);
    expect(visible("27")).toEqual(["User Overrides"]);
    expect(visible("30")).toEqual(["Membership"]);
    expect(visible("31")).toEqual(["Rates", "Tax Reports"]);
    expect(visible("33")).toEqual([]);
    expect(visible("35")).toEqual(["Cash Drawer", "Device Events"]);
    expect(visible("38")).toEqual(["Transaction Linking"]);
    expect(visible("39")).toEqual([]);
    expect(ERP_SIDEBAR_SECTIONS).toHaveLength(39);
    expect(ERP_SIDEBAR_SECTIONS.some((s) => s.path === "/held-sales")).toBe(false);
    expect(ERP_SIDEBAR_SECTIONS.some((s) => s.path === "/credit")).toBe(false);
    expect(ERP_SIDEBAR_SECTIONS.some((s) => s.path === "/pos/new")).toBe(false);
    expect(ERP_SIDEBAR_SECTIONS.some((s) => s.path === "/pos/installments")).toBe(false);
    expect(ERP_SIDEBAR_SECTIONS.find((s) => s.id === "05")?.children.some((c) => c.path === "/pos/salesmen")).toBe(
      false,
    );
    expect(ERP_SIDEBAR_SECTIONS.find((s) => s.id === "05")?.children.some((c) => c.path === "/exchange")).toBe(
      false,
    );
    expect(ERP_SIDEBAR_SECTIONS.find((s) => s.id === "12")?.children.some((c) => c.path === "/credit")).toBe(
      false,
    );
    expect(ERP_SIDEBAR_SECTIONS.find((s) => s.id === "03")?.children.some((c) => c.path === "/qr")).toBe(false);
  });

  it("reuses existing screens for shared children and keeps Coming Soon items as placeholders", () => {
    const child = (id: string, title: string) =>
      ERP_NAV_SECTIONS.find((s) => s.id === id)?.children.find((c) => c.title === title);

    expect(child("05", "Salesmen")?.path).toBe("/pos/salesmen");
    expect(child("05", "Installments")?.path).toBe("/pos/installments");
    expect(child("05", "References")?.path).toBe("/pos/references");
    expect(child("07", "B2B")?.path).toBe("/b2b");
    expect(child("16", "P&L")?.path).toBe("/accounts/profit-loss");
    expect(child("13", "Price Lists")?.path).toBe("/suppliers/price-lists");

    expect(child("05", "Discounts")?.status).toBe("implemented");
    expect(child("05", "Discounts")?.path).toBe("/discounts");

    for (const [id, title] of [
      ["09", "Automation"],
      ["11", "Receiving"],
      ["11", "Dispatch"],
      ["12", "Receivables"],
      ["13", "Payables"],
      ["13", "Performance"],
      ["16", "Cash"],
      ["16", "Receipts"],
      ["39", "Maintenance"],
      ["39", "Mobile"],
    ] as const) {
      expect(child(id, title)?.status).toBe("placeholder");
    }
  });

  it("keeps landing children under parents and hides implementation-only aliases", () => {
    const sales = ERP_SIDEBAR_SECTIONS.find((s) => s.id === "05");
    expect(sales?.children.some((c) => c.title === "New Sale" && c.path === "/pos")).toBe(false);
    expect(sales?.children.some((c) => c.title === "Hold / Resume" && c.path === "/held-sales")).toBe(true);
    expect(sales?.children.some((c) => c.path === "/pos/new")).toBe(false);
    expect(sales?.children.some((c) => c.path === "/pos/salesmen")).toBe(false);
    expect(sales?.children.some((c) => c.path === "/pos/references")).toBe(false);
    expect(sales?.children.some((c) => c.path === "/pos/installments")).toBe(false);
    expect(sales?.children.some((c) => c.title === "POS")).toBe(false);
    expect(sales?.children.some((c) => c.title === "Customer / Checkout helpers")).toBe(false);
    const printing = ERP_SIDEBAR_SECTIONS.find((s) => s.id === "33");
    expect(printing?.children.map((c) => c.title)).toEqual([]);
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

  it("points duplicate routes at the canonical page without merging files", () => {
    const registered = new Set<string>([...ERP_MODULES.map((m) => m.path), ...EXTRA_APP_PATHS]);
    const pageType = (path: string) => {
      const el = IMPLEMENTED_ROUTES[path];
      expect(isValidElement(el), path).toBe(true);
      return isValidElement(el) ? el.type : null;
    };

    for (const pair of DUPLICATE_ROUTE_PAIRS) {
      expect(registered.has(pair.canonical), pair.canonical).toBe(true);
      expect(registered.has(pair.duplicate), pair.duplicate).toBe(true);
      if (pair.sameComponent === false) {
        expect(pageType(pair.canonical)).not.toBe(pageType(pair.duplicate));
      } else {
        expect(pageType(pair.canonical)).toBe(pageType(pair.duplicate));
      }
    }

    expect(pageType("/pos")).not.toBe(pageType("/held-sales"));
    expect(pageType("/invoices")).not.toBe(pageType("/sales-management"));
    expect(pageType("/quotations")).toBe(pageType("/orders"));
    expect(pageType("/returns")).not.toBe(pageType("/exchange"));
    expect(pageType("/barcodes")).toBe(pageType("/qr"));
    expect(pageType("/installments")).toBe(pageType("/credit"));
    expect(pageType("/installments")).not.toBe(pageType("/pos/installments"));
    expect(pageType("/salesman")).not.toBe(pageType("/pos/salesmen"));
    expect(pageType("/salesman")).not.toBe(pageType("/pos/references"));
    expect(pageType("/pos/salesmen")).not.toBe(pageType("/pos/references"));
    expect(pageType("/categories")).toBe(pageType("/subcategories"));
    expect(pageType("/stock-ops")).toBe(pageType("/inventory/adjustments"));
    expect(pageType("/inventory")).not.toBe(pageType("/stock-ops"));
  });

  it("covers extra deep-link paths used by the router", () => {
    expect(EXTRA_APP_PATHS).toContain("/products/new");
    expect(EXTRA_APP_PATHS).toContain("/pos/new");
    expect(router.routes.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(router.routes);
    for (const path of [
      "/pos",
      "/pos/new",
      "/held-sales",
      "/invoices",
      "/returns",
      "/exchange",
      "/payments",
      "/discounts",
      "/customers",
      "/products",
      "/credit",
      "/salesman",
    ]) {
      expect(serialized).toContain(path.replace(/^\//, ""));
    }
    expect(serialized).toContain("*");
  });

  it("registers every parent and child navigation path", () => {
    const modulePaths = new Set(ERP_MODULES.map((m) => m.path));
    for (const section of ERP_NAV_SECTIONS) {
      expect(modulePaths.has(section.path)).toBe(true);
      for (const child of section.children) {
        expect(modulePaths.has(child.path)).toBe(true);
      }
    }
    expect(ERP_NAV_SECTIONS).toHaveLength(39);
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
    expect(
      screen.getAllByRole("link", { name: "Customers" }).some((link) => link.getAttribute("href") === "/customers"),
    ).toBe(true);
    expect(screen.getByRole("link", { name: "Product Management" })).toHaveAttribute(
      "title",
      "Product Management",
    );
    expect(screen.getByRole("link", { name: "Industry Engine" })).toHaveAttribute(
      "href",
      "/industry-engine",
    );
    rerender(
      <MemoryRouter initialEntries={["/customers"]}>
        <SidebarNav query="" onNavigate={() => undefined} collapsed />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("ERP modules")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Collapse Customers/i })).not.toBeInTheDocument();
  });

  it("finds a parent by official module name without listing every route as a top-level item", () => {
    const view = render(
      <MemoryRouter initialEntries={["/"]}>
        <SidebarNav query="Product Management" onNavigate={() => undefined} />
      </MemoryRouter>,
    );
    expect(view.getByRole("link", { name: "Product Management" })).toBeInTheDocument();
    expect(view.queryByRole("link", { name: "Customers" })).not.toBeInTheDocument();
  });

  it("renders all 39 official master names as sidebar parents", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SidebarNav query="" onNavigate={() => undefined} />
      </MemoryRouter>,
    );
    for (const section of ERP_NAV_SECTIONS) {
      const matches = screen
        .getAllByRole("link", { name: section.masterTitle })
        .filter((link) => link.getAttribute("href") === section.path);
      expect(matches.length).toBeGreaterThan(0);
    }
  }, 15_000);

  it("keeps Salesmen as module 20 and hides the POS alias from the sidebar", () => {
    expect(ERP_MODULES.some((m) => m.path === "/pos/salesmen")).toBe(true);
    expect(ERP_SIDEBAR_SECTIONS.find((s) => s.id === "05")?.children.some((c) => c.path === "/pos/salesmen")).toBe(
      false,
    );
    render(
      <MemoryRouter initialEntries={["/pos"]}>
        <SidebarNav query="" onNavigate={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: "Salesmen" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "POS / Sales" })).toHaveAttribute("href", "/pos");
    expect(screen.getByRole("link", { name: "Salesman / Field Sales" })).toHaveAttribute(
      "href",
      "/salesman",
    );
  });

  it("resolves the ERP header from the official module tree", () => {
    expect(resolveShellHeader("/pos")).toEqual({
      moduleTitle: "POS / Sales",
      pageTitle: "New Sale",
    });
    expect(resolveShellHeader("/pos/new")).toEqual({
      moduleTitle: "POS / Sales",
      pageTitle: "New Sale",
    });
    expect(resolveShellHeader("/held-sales")).toEqual({
      moduleTitle: "POS / Sales",
      pageTitle: "Hold / Resume",
    });
    expect(resolveShellHeader("/invoices")).toEqual({
      moduleTitle: "POS / Sales",
      pageTitle: "Invoices",
    });
    expect(resolveShellHeader("/returns")).toEqual({
      moduleTitle: "POS / Sales",
      pageTitle: "Returns",
    });
    expect(resolveShellHeader("/exchange")).toEqual({
      moduleTitle: "POS / Sales",
      pageTitle: "Exchange",
    });
    expect(resolveShellHeader("/payments")).toEqual({
      moduleTitle: "POS / Sales",
      pageTitle: "Payments",
    });
    expect(resolveShellHeader("/discounts")).toEqual({
      moduleTitle: "POS / Sales",
      pageTitle: "Discounts",
    });
    expect(resolveShellHeader("/products")).toEqual({
      moduleTitle: "Product Management",
      pageTitle: "Products",
    });
    expect(resolveShellHeader("/settings")).toEqual({
      moduleTitle: "System Administration",
      pageTitle: "Overview",
    });
    expect(resolveShellHeader("/security")).toEqual({
      moduleTitle: "System Administration",
      pageTitle: "Security",
    });
    expect(resolveShellHeader("/settings/numbering")).toEqual({
      moduleTitle: "System Administration",
      pageTitle: "Date & Numbering",
    });
  });

  it("expands the active parent and shows its children", () => {
    render(
      <MemoryRouter initialEntries={["/invoices"]}>
        <SidebarNav query="" onNavigate={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Hold / Resume" })).toHaveAttribute("href", "/held-sales");
    expect(screen.getByRole("link", { name: "Invoices" })).toHaveAttribute("href", "/invoices");
    expect(screen.getByRole("link", { name: "POS / Sales" })).toHaveAttribute("href", "/pos");
    expect(screen.queryByRole("link", { name: "New Sale" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Exchange" })).not.toBeInTheDocument();
  });

  it("keeps the POS terminal on module 05 instead of a separate nav tree", () => {
    render(
      <MemoryRouter initialEntries={["/pos"]}>
        <SidebarNav query="" onNavigate={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "POS / Sales" })).toHaveAttribute("href", "/pos");
    expect(screen.queryByRole("link", { name: "New Sale" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hold / Resume" })).toHaveAttribute("href", "/held-sales");
    const returnsLinks = screen.getAllByRole("link", { name: "Returns" });
    expect(returnsLinks.some((link) => link.getAttribute("href") === "/returns")).toBe(true);
    expect(screen.queryByRole("link", { name: "Exchange" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Payments" })).toHaveAttribute("href", "/payments");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/");
  });

  it("keeps System Administration as module 39 with a control-center workspace", () => {
    expect(ERP_NAV_SECTIONS[38]?.id).toBe("39");
    expect(ERP_NAV_SECTIONS[38]?.masterTitle).toBe("System Administration");
    expect(ERP_MODULES.find((m) => m.path === "/settings")?.status).toBe("implemented");
    expect(isSystemAdminPath("/settings")).toBe(true);
    expect(isSystemAdminPath("/security")).toBe(true);
    expect(isSystemAdminPath("/integrations")).toBe(true);
    expect(isSystemAdminPath("/online-store")).toBe(true);
    expect(isSystemAdminPath("/hr")).toBe(true);
    expect(isSystemAdminPath("/mobile")).toBe(true);
    expect(isSystemAdminPath("/settings/company")).toBe(true);
    expect(isSystemAdminPath("/pos")).toBe(false);

    expect(isValidElement(IMPLEMENTED_ROUTES["/security"])).toBe(true);
    expect(isValidElement(IMPLEMENTED_ROUTES["/integrations"])).toBe(true);
    expect(isValidElement(IMPLEMENTED_ROUTES["/online-store"])).toBe(true);
    expect(isValidElement(IMPLEMENTED_ROUTES["/hr"])).toBe(true);
    expect(isValidElement(IMPLEMENTED_ROUTES["/settings"])).toBe(true);

    render(
      <MemoryRouter initialEntries={["/security"]}>
        <SystemAdminLayout>
          <div>Security workspace</div>
        </SystemAdminLayout>
      </MemoryRouter>,
    );
    expect(screen.getByRole("navigation", { name: "System Administration" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute("href", "/security");
    expect(screen.getByRole("link", { name: "HR" })).toHaveAttribute("href", "/hr");
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.getByText("Access & channels")).toBeInTheDocument();
    expect(screen.getByText("Security workspace")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "ERP modules" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "System Administration" }).innerHTML).not.toContain(
      "overflow-x-auto",
    );

    cleanup();
    render(
      <MemoryRouter>
        <SystemAdminHome />
      </MemoryRouter>,
    );
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText(/Coming Soon/i)).toBeInTheDocument();
    expect(screen.getAllByText("Live").length).toBeGreaterThanOrEqual(4);
  });

  it("wraps official parent labels and shows module numbers 01–39", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SidebarNav query="" onNavigate={() => undefined} />
      </MemoryRouter>,
    );
    expect(document.querySelectorAll("[data-erp-module]")).toHaveLength(39);
    for (const name of [
      "AI Camera Product Recognition",
      "Tax & Pakistan Compliance",
      "Backup & Disaster Recovery",
      "Users & Role Management",
      "Rules / Automation Engine",
      "System Administration",
    ]) {
      const link = screen.getByRole("link", { name });
      const label = link.querySelector("[data-erp-label]");
      expect(label?.textContent).toBe(name);
      expect(label?.className).not.toContain("truncate");
    }
    expect(document.querySelector('[data-erp-module="01"]')?.textContent).toContain("01");
    expect(document.querySelector('[data-erp-module="39"]')?.textContent).toContain("39");
  });

  it("closes the shared drawer callback when a child is opened", () => {
    const onNavigate = vi.fn();
    render(
      <MemoryRouter initialEntries={["/invoices"]}>
        <SidebarNav query="" onNavigate={onNavigate} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Hold / Resume" }));
    expect(onNavigate).toHaveBeenCalled();
  });

  it("expands and highlights the parent for deep-linked children", () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/security"]}>
        <SidebarNav query="" onNavigate={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "System Administration" }).className).toContain(
      "erp-brand-soft",
    );
    unmount();

    render(
      <MemoryRouter initialEntries={["/exchange"]}>
        <SidebarNav query="" onNavigate={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "POS / Sales" }).className).toContain("erp-brand-soft");
  });
});

describe("responsive ERP shell", () => {
  function renderShell(path = "/") {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="*" element={<div>workspace</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
  }

  it("uses one 39-module nav as the mobile drawer, not a second menu", () => {
    const { container } = renderShell("/");
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain("md:grid");
    expect(shell.className).toContain("overflow-x-hidden");
    expect(screen.getByRole("button", { name: "Menu" }).className).toContain("md:hidden");
    expect(screen.getByRole("button", { name: "Collapse sidebar" }).className).toContain("md:inline-flex");
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("button", { name: "Close navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.getAllByLabelText("ERP modules")).toHaveLength(1);
    for (const section of ERP_NAV_SECTIONS) {
      const matches = screen
        .getAllByRole("link", { name: section.masterTitle })
        .filter((link) => link.getAttribute("href") === section.path);
      expect(matches.length).toBeGreaterThan(0);
    }
    fireEvent.click(screen.getByRole("link", { name: "POS / Sales" }));
    expect(screen.queryByRole("button", { name: "Close navigation" })).not.toBeInTheDocument();
  }, 15_000);

  it("opens a single POS environment for POS operational routes", () => {
    const { unmount } = renderShell("/pos");
    expect(screen.queryByLabelText("ERP modules")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "ERP Home" }).every((link) => link.getAttribute("href") === "/")).toBe(
      true,
    );
    expect(screen.getByText("POS Terminal")).toBeInTheDocument();
    expect(screen.getByLabelText("Cashier")).toBeInTheDocument();
    expect(screen.getByLabelText("Shift Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Date / Time")).toBeInTheDocument();
    expect(screen.getByLabelText("Branch")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Held Sales" })).toHaveAttribute("href", "/held-sales");
    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/notifications");
    expect(screen.getByRole("button", { name: "User" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "POS navigation" });
    const hrefs = [...nav.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(POS_SHELL_NAV.map((item) => item.path));
    expect(screen.getByRole("link", { name: "New Sale" }).className).toContain("pos-nav-active");
    expect(POS_SHELL_NAV_TITLES).toEqual([
      "New Sale",
      "Hold / Resume",
      "Customers",
      "Products",
      "Price & Discount",
      "Reports",
      "Settings",
    ]);
    expect(POS_IA_TITLES).toHaveLength(12);
    unmount();

    renderShell("/invoices");
    expect(screen.getByRole("navigation", { name: "POS navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reports" }).className).toContain("pos-nav-active");
    expect(screen.queryByLabelText("ERP modules")).not.toBeInTheDocument();
    cleanup();

    renderShell("/pos/salesmen");
    expect(screen.getByRole("link", { name: "Reports" }).className).toContain("pos-nav-active");
    expect(screen.getAllByRole("link", { name: "ERP Home" }).every((link) => link.getAttribute("href") === "/")).toBe(
      true,
    );
    cleanup();

    renderShell("/salesman");
    expect(screen.getByLabelText("ERP modules")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "POS navigation" })).not.toBeInTheDocument();
  }, 20_000);
});
