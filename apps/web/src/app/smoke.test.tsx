import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@electronic-erp/ui";
import { ModulePlaceholderPage } from "@/features/modules/ModulePlaceholderPage";
import {
  canShowNavItem,
  ERP_FEATURE_FOLDERS,
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
      "POS",
      "Hold / Resume",
      "Invoices",
      "Sales Register",
      "Returns",
      "Exchange",
      "Payments",
      "Discounts",
      "References",
      "Salesmen",
      "Installments",
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
      "Product Management",
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
      "POS",
      "Hold / Resume",
      "Invoices",
      "Sales Register",
      "Returns",
      "Exchange",
      "Payments",
      "Discounts",
      "References",
      "Salesmen",
      "Installments",
    ]);
    expect(titles("07")).toEqual(["Orders", "B2B"]);
    expect(titles("09")).toEqual(["Purchases", "Purchase Returns", "Automation"]);
    expect(titles("10")).toEqual([
      "Inventory",
      "Movements",
      "Batches",
      "Serials",
      "Expiry",
      "Adjustments",
      "Damaged",
      "Counts / Audit",
    ]);
    expect(titles("19")).toEqual(["Reports", "BI", "AI Insights"]);
    expect(titles("20")).toEqual(["Salesmen", "References", "Commissions"]);
    expect(titles("26")).toEqual(["Users / Roles"]);
    expect(titles("31")).toEqual(["Tax Profile", "Tax Rates", "Tax Reports"]);
    expect(titles("32")).toEqual(["Import", "Export", "Templates"]);
    expect(titles("33")).toEqual(["Printing", "Print Queue", "Preview"]);
    expect(titles("34")).toEqual(["Backup", "Restore Points"]);
    expect(titles("35")).toEqual(["Devices", "Drawer", "Device Events"]);
    expect(titles("36")).toEqual(["Coming Soon"]);
    expect(titles("37")).toEqual(["Coming Soon"]);
    expect(titles("38")).toEqual(["Rules", "Transaction Linking", "Coming Soon"]);
    expect(titles("39")?.filter((t) => t !== "Numbering")).toEqual([
      "Company",
      "Localization",
      "Currency",
      "Language",
      "Date / Numbering",
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
    }
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

  it("hides repeated parent-path children from the ERP sidebar", () => {
    for (const section of ERP_SIDEBAR_SECTIONS) {
      expect(section.children.some((child) => child.path === section.path)).toBe(false);
    }
    const sales = ERP_SIDEBAR_SECTIONS.find((s) => s.id === "05");
    expect(sales?.children.some((c) => c.title === "Customer / Checkout helpers")).toBe(false);
    expect(sales?.children.some((c) => c.title === "New Sale")).toBe(false);
    expect(sales?.children.some((c) => c.title === "POS")).toBe(false);
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
