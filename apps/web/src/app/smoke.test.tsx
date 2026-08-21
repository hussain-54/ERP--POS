import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@electronic-erp/ui";
import { ModulePlaceholderPage } from "@/features/modules/ModulePlaceholderPage";
import {
  canShowNavItem,
  DUPLICATE_ROUTE_PAIRS,
  ERP_FEATURE_FOLDERS,
  ERP_MODULE_REGISTRY,
  ERP_MODULES,
  ERP_NAV_SECTIONS,
  ERP_SIDEBAR_SECTIONS,
  ERP_STABLE_PARENT_PATHS,
  EXTRA_APP_PATHS,
  findSectionForPath,
  isComingSoonEngineSection,
  isPosEnvironmentPath,
  isPosTerminalPath,
  isSystemAdminPath,
  resolveShellHeader,
} from "@/app/modules";
import { POS_IA_TITLES } from "@/features/pos/pos-ownership";
import { AppShell } from "@/app/shell/AppShell";
import { ModuleWorkspace } from "@/app/shell/ModuleWorkspace";
import { SidebarNav } from "@/app/shell/SidebarNav";
import { AuthProvider } from "@/features/auth/AuthContext";
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
    expect(ERP_MODULES.some((m) => m.path === "/command-center")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/product-catalog")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/products")).toBe(true);
    for (const alias of [
      "/",
      "/purchases",
      "/warehouses",
      "/deliveries",
      "/ai-camera",
      "/loyalty",
      "/branches",
      "/approvals",
      "/audit",
      "/industry-engine",
      "/customization-engine",
      "/rules-engine",
      "/billing",
    ]) {
      expect(ERP_MODULES.some((m) => m.path === alias), alias).toBe(true);
    }
    const sales = ERP_NAV_SECTIONS.find((s) => s.id === "02");
    expect(sales?.name).toBe("POS / SALES");
    expect(sales?.title).toBe("POS / SALES");
    expect(sales?.children.map((c) => c.title)).toEqual([...POS_IA_TITLES]);
    expect(ERP_MODULES.some((m) => m.path === "/held-sales")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/pos/salesmen")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/pos/installments")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/salesman")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/installments")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/credit")).toBe(true);
    expect(isPosTerminalPath("/pos")).toBe(true);
    expect(isPosTerminalPath("/held-sales")).toBe(true);
    expect(isPosTerminalPath("/pos/new")).toBe(true);
    expect(isPosTerminalPath("/pos/resume-sale")).toBe(true);
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
    expect(ERP_NAV_SECTIONS.find((s) => s.id === "27")?.status).toBe("placeholder");
    expect(ERP_NAV_SECTIONS.find((s) => s.id === "28")?.status).toBe("placeholder");
    expect(ERP_MODULES.some((m) => /sqlite|sync queue/i.test(m.title))).toBe(false);
  });
});

describe("39-module navigation lock", () => {
  const LOCKED_PARENTS = [
    { id: "01", number: "01", name: "COMMAND CENTER", masterTitle: "COMMAND CENTER", title: "COMMAND CENTER", path: "/command-center" },
    { id: "02", number: "02", name: "POS / SALES", masterTitle: "POS / SALES", title: "POS / SALES", path: "/pos" },
    { id: "03", number: "03", name: "PRODUCT & CATALOG", masterTitle: "PRODUCT & CATALOG", title: "PRODUCT & CATALOG", path: "/product-catalog" },
    { id: "04", number: "04", name: "PURCHASING", masterTitle: "PURCHASING", title: "PURCHASING", path: "/purchasing" },
    { id: "05", number: "05", name: "INVENTORY", masterTitle: "INVENTORY", title: "INVENTORY", path: "/inventory" },
    { id: "06", number: "06", name: "WAREHOUSE / WMS", masterTitle: "WAREHOUSE / WMS", title: "WAREHOUSE / WMS", path: "/warehouse" },
    { id: "07", number: "07", name: "DELIVERY / LOGISTICS", masterTitle: "DELIVERY / LOGISTICS", title: "DELIVERY / LOGISTICS", path: "/delivery" },
    { id: "08", number: "08", name: "CUSTOMERS / CRM", masterTitle: "CUSTOMERS / CRM", title: "CUSTOMERS / CRM", path: "/customers" },
    { id: "09", number: "09", name: "SERVICE MANAGEMENT", masterTitle: "SERVICE MANAGEMENT", title: "SERVICE MANAGEMENT", path: "/service" },
    { id: "10", number: "10", name: "WARRANTY", masterTitle: "WARRANTY", title: "WARRANTY", path: "/warranty" },
    { id: "11", number: "11", name: "ACCOUNTS & FINANCE", masterTitle: "ACCOUNTS & FINANCE", title: "ACCOUNTS & FINANCE", path: "/accounts" },
    { id: "12", number: "12", name: "BANKING & PAYMENTS", masterTitle: "BANKING & PAYMENTS", title: "BANKING & PAYMENTS", path: "/banking" },
    { id: "13", number: "13", name: "REPORTS & BUSINESS INTELLIGENCE", masterTitle: "REPORTS & BUSINESS INTELLIGENCE", title: "REPORTS & BUSINESS INTELLIGENCE", path: "/reports" },
    { id: "14", number: "14", name: "AI & AUTOMATION", masterTitle: "AI & AUTOMATION", title: "AI & AUTOMATION", path: "/ai" },
    { id: "15", number: "15", name: "MARKETING & LOYALTY", masterTitle: "MARKETING & LOYALTY", title: "MARKETING & LOYALTY", path: "/marketing" },
    { id: "16", number: "16", name: "B2B / WHOLESALE", masterTitle: "B2B / WHOLESALE", title: "B2B / WHOLESALE", path: "/b2b" },
    { id: "17", number: "17", name: "ONLINE STORE", masterTitle: "ONLINE STORE", title: "ONLINE STORE", path: "/online-store" },
    { id: "18", number: "18", name: "MOBILE", masterTitle: "MOBILE", title: "MOBILE", path: "/mobile" },
    { id: "19", number: "19", name: "ORGANIZATION / BRANCHES", masterTitle: "ORGANIZATION / BRANCHES", title: "ORGANIZATION / BRANCHES", path: "/organization" },
    { id: "20", number: "20", name: "HR & PAYROLL", masterTitle: "HR & PAYROLL", title: "HR & PAYROLL", path: "/hr" },
    { id: "21", number: "21", name: "TAX / FBR", masterTitle: "TAX / FBR", title: "TAX / FBR", path: "/tax" },
    { id: "22", number: "22", name: "DOCUMENT MANAGEMENT", masterTitle: "DOCUMENT MANAGEMENT", title: "DOCUMENT MANAGEMENT", path: "/documents" },
    { id: "23", number: "23", name: "WORKFLOW / APPROVALS", masterTitle: "WORKFLOW / APPROVALS", title: "WORKFLOW / APPROVALS", path: "/workflows" },
    { id: "24", number: "24", name: "NOTIFICATIONS", masterTitle: "NOTIFICATIONS", title: "NOTIFICATIONS", path: "/notifications" },
    { id: "25", number: "25", name: "USERS / ROLES / PERMISSIONS", masterTitle: "USERS / ROLES / PERMISSIONS", title: "USERS / ROLES / PERMISSIONS", path: "/users" },
    { id: "26", number: "26", name: "SECURITY / AUDIT", masterTitle: "SECURITY / AUDIT", title: "SECURITY / AUDIT", path: "/security" },
    { id: "27", number: "27", name: "OFFLINE / LOCAL OPERATIONS", masterTitle: "OFFLINE / LOCAL OPERATIONS", title: "OFFLINE / LOCAL OPERATIONS", path: "/offline" },
    { id: "28", number: "28", name: "SYNC CENTER", masterTitle: "SYNC CENTER", title: "SYNC CENTER", path: "/sync" },
    { id: "29", number: "29", name: "BACKUP / DISASTER RECOVERY", masterTitle: "BACKUP / DISASTER RECOVERY", title: "BACKUP / DISASTER RECOVERY", path: "/backup" },
    { id: "30", number: "30", name: "INTEGRATION HUB", masterTitle: "INTEGRATION HUB", title: "INTEGRATION HUB", path: "/integrations" },
    { id: "31", number: "31", name: "DEVICES / PRINTING", masterTitle: "DEVICES / PRINTING", title: "DEVICES / PRINTING", path: "/devices" },
    { id: "32", number: "32", name: "INDUSTRY ENGINE", masterTitle: "INDUSTRY ENGINE", title: "INDUSTRY ENGINE", path: "/industry" },
    { id: "33", number: "33", name: "CUSTOMIZATION ENGINE", masterTitle: "CUSTOMIZATION ENGINE", title: "CUSTOMIZATION ENGINE", path: "/customization" },
    { id: "34", number: "34", name: "RULES / AUTOMATION ENGINE", masterTitle: "RULES / AUTOMATION ENGINE", title: "RULES / AUTOMATION ENGINE", path: "/automation" },
    { id: "35", number: "35", name: "CLIENT / TENANT MANAGEMENT", masterTitle: "CLIENT / TENANT MANAGEMENT", title: "CLIENT / TENANT MANAGEMENT", path: "/tenants" },
    { id: "36", number: "36", name: "SUBSCRIPTION / BILLING", masterTitle: "SUBSCRIPTION / BILLING", title: "SUBSCRIPTION / BILLING", path: "/subscription" },
    { id: "37", number: "37", name: "USAGE / METERING", masterTitle: "USAGE / METERING", title: "USAGE / METERING", path: "/usage" },
    { id: "38", number: "38", name: "DEVELOPER PLATFORM", masterTitle: "DEVELOPER PLATFORM", title: "DEVELOPER PLATFORM", path: "/developer" },
    { id: "39", number: "39", name: "SYSTEM ADMINISTRATION", masterTitle: "SYSTEM ADMINISTRATION", title: "SYSTEM ADMINISTRATION", path: "/settings" },
  ] as const;

  it("locks exactly 39 top-level parents with official names and short labels", () => {
    expect(ERP_NAV_SECTIONS).toHaveLength(39);
    expect(ERP_MODULE_REGISTRY).toBe(ERP_NAV_SECTIONS);
    expect(ERP_NAV_SECTIONS.map((s) => s.id)).toEqual(LOCKED_PARENTS.map((p) => p.id));
    for (const [index, expected] of LOCKED_PARENTS.entries()) {
      const section = ERP_NAV_SECTIONS[index];
      expect(section).toMatchObject(expected);
      expect(section?.permissions).toBe(section?.permission);
      expect(section?.featureOwnership).toBe(section?.folder);
    }
    expect(ERP_NAV_SECTIONS.map((s) => s.path)).toEqual([...ERP_STABLE_PARENT_PATHS]);
  });

  it("keeps B2B, AI Insights, and HR under their approved parents", () => {
    const wholesale = ERP_NAV_SECTIONS.find((s) => s.id === "16");
    expect(wholesale?.children.some((c) => c.title === "B2B" && c.path === "/b2b")).toBe(true);

    const ai = ERP_NAV_SECTIONS.find((s) => s.id === "14");
    expect(ai?.children.some((c) => c.title === "AI Insights" && c.path === "/ai-insights")).toBe(true);

    const system = ERP_NAV_SECTIONS.find((s) => s.id === "39");
    expect(system?.path).toBe("/settings");
    expect(system?.children.length).toBeGreaterThan(0);
    expect(ERP_NAV_SECTIONS.filter((s) => s.children.some((c) => c.path === "/hr")).map((s) => s.id)).toEqual(
      ["20"],
    );
  });

  it("keeps Salesmen and Installments reachable without promoting them to global modules", () => {
    const sales = ERP_NAV_SECTIONS.find((s) => s.id === "02");
    const hr = ERP_NAV_SECTIONS.find((s) => s.id === "20");
    const customers = ERP_NAV_SECTIONS.find((s) => s.id === "08");

    expect(hr?.path).toBe("/hr");
    expect(hr?.children.some((c) => c.title === "Salesmen" && c.path === "/salesman")).toBe(true);
    expect(customers?.children.some((c) => c.title === "Installments" && c.path === "/installments")).toBe(true);
    expect(sales?.children.some((c) => c.title === "Salesman / Reference" && c.path === "/pos/salesman-reference")).toBe(
      true,
    );
    expect(sales?.children.some((c) => c.title === "Installments" && c.path === "/pos/installments")).toBe(
      true,
    );
  });

  it("locks child navigation titles under each parent", () => {
    const titles = (id: string) =>
      ERP_NAV_SECTIONS.find((s) => s.id === id)?.children.map((c) => c.title);
    expect(titles("01")).toEqual(["Modules"]);
    expect(titles("02")).toEqual([...POS_IA_TITLES]);
    expect(titles("03")).toEqual([
      "Products",
      "New Product",
      "Categories",
      "Subcategories",
      "Brands",
      "Companies",
      "Units",
      "Pricing",
      "Barcodes",
      "QR",
      "Variants",
      "Attributes",
      "Media",
      "Specifications",
    ]);
    expect(titles("04")).toEqual([
      "Purchases",
      "Returns",
      "Suppliers",
      "Ledger",
      "Price Lists",
      "Payables",
      "Performance",
      "Automation",
    ]);
    expect(titles("05")).toEqual([
      "Inventory",
      "Movements",
      "Batches",
      "Serials",
      "Expiry",
      "Adjustments",
      "Damaged",
      "Counts",
    ]);
    expect(titles("06")).toEqual([
      "Warehouses",
      "Racks",
      "Shelves",
      "Bins",
      "Receiving",
      "Dispatch",
      "Transfers",
    ]);
    expect(titles("07")).toEqual(["Delivery"]);
    expect(titles("08")).toEqual([
      "Customers",
      "Ledger",
      "Receivables",
      "Credit",
      "History",
      "Installments",
      "CRM",
      "Campaigns",
      "Engagement",
    ]);
    expect(titles("09")).toEqual(["Service", "Complaints", "Technicians", "Repairs", "Charges"]);
    expect(titles("10")).toEqual(["Warranty", "Replacements", "History"]);
    expect(titles("11")).toEqual(["Accounts", "Cash", "Journals", "Receipts", "P&L", "Expenses", "Period Reports"]);
    expect(titles("12")).toEqual(["Banking"]);
    expect(titles("13")).toEqual(["Reports", "BI"]);
    expect(titles("14")).toEqual(["AI Camera", "AI Insights"]);
    expect(titles("15")).toEqual(["Loyalty", "Offers", "Redeem", "SMS", "WhatsApp", "Marketing"]);
    expect(titles("16")).toEqual(["B2B", "Quotations", "Orders"]);
    expect(titles("17")).toEqual(["Store"]);
    expect(titles("18")).toEqual(["Coming Soon"]);
    expect(titles("19")).toEqual(["Branches", "Membership"]);
    expect(titles("20")).toEqual(["HR", "Salesmen", "References", "Commissions"]);
    expect(titles("21")).toEqual(["Tax", "Rates", "Tax Reports"]);
    expect(titles("22")).toEqual(["Documents"]);
    expect(titles("23")).toEqual(["Approvals"]);
    expect(titles("24")).toEqual(["Notifications"]);
    expect(titles("25")).toEqual(["Users", "Roles", "Permissions", "User Overrides"]);
    expect(titles("26")).toEqual(["Audit", "Security"]);
    expect(titles("27")).toEqual(["Coming Soon"]);
    expect(titles("28")).toEqual(["Coming Soon"]);
    expect(titles("29")).toEqual(["Backup", "Restore Points"]);
    expect(titles("30")).toEqual(["Integrations"]);
    expect(titles("31")).toEqual(["Devices", "Cash Drawer", "Device Events", "Printing", "Print Queue", "Preview"]);
    expect(titles("32")).toEqual(["Coming Soon"]);
    expect(titles("33")).toEqual(["Coming Soon"]);
    expect(titles("34")).toEqual(["Automation", "Transaction Linking", "Rules"]);
    expect(titles("35")).toEqual(["Coming Soon"]);
    expect(titles("36")).toEqual(["Coming Soon"]);
    expect(titles("37")).toEqual(["Coming Soon"]);
    expect(titles("38")).toEqual(["Coming Soon"]);
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
      "Import",
      "Export",
      "Import Templates",
    ]);
  });

  it("keeps placeholder engines as Coming Soon without implementing offline/sync", () => {
    for (const id of ["18", "27", "28", "32", "33", "34", "35", "36", "37", "38"]) {
      const section = ERP_NAV_SECTIONS.find((s) => s.id === id);
      const route = ERP_MODULES.find((m) => m.path === section?.path);
      expect(route?.status).toBe("placeholder");
      expect(isComingSoonEngineSection(section!)).toBe(true);
    }
    expect(isComingSoonEngineSection({ id: "39" })).toBe(false);
    expect(isComingSoonEngineSection({ id: "02" })).toBe(false);
  });

  it("locks frontend feature folder names without inventing placeholder folders", () => {
    expect(ERP_FEATURE_FOLDERS).toHaveLength(39);
    expect(ERP_FEATURE_FOLDERS.map((row) => row.id)).toEqual(ERP_NAV_SECTIONS.map((s) => s.id));
    expect(ERP_FEATURE_FOLDERS.map((row) => row.folder)).toEqual([
      "dashboard",
      "pos",
      "product-management",
      "purchases",
      "inventory",
      "warehouses",
      "delivery",
      "customers",
      "service-repair",
      "warranty",
      "accounts",
      "banking",
      "reports",
      "ai-camera",
      "loyalty",
      "orders",
      "system",
      null,
      "branches",
      "system",
      "tax",
      "documents",
      "approvals",
      "notifications",
      "users",
      "audit",
      null,
      null,
      "backup",
      "system",
      "devices",
      null,
      null,
      null,
      null,
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
      expect(section.title).not.toMatch(/page|management system$/i);
      expect(section.path).toMatch(/^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/);
      expect(section.permission).toBeTruthy();
      for (const child of section.children) {
        expect(child.title.length).toBeGreaterThan(0);
        expect(child.path.startsWith("/")).toBe(true);
        expect(child.permission).toBeTruthy();
      }
    }
  });

  it("shows only the 39 parents in global navigation", () => {
    expect(ERP_SIDEBAR_SECTIONS).toHaveLength(39);
    for (const section of ERP_SIDEBAR_SECTIONS) {
      expect(section.children).toEqual([]);
    }
    expect(ERP_SIDEBAR_SECTIONS.some((s) => s.path === "/held-sales")).toBe(false);
    expect(ERP_SIDEBAR_SECTIONS.some((s) => s.path === "/credit")).toBe(false);
    expect(ERP_SIDEBAR_SECTIONS.some((s) => s.path === "/pos/new")).toBe(false);
    expect(ERP_SIDEBAR_SECTIONS.some((s) => s.path === "/pos/installments")).toBe(false);
    expect(ERP_SIDEBAR_SECTIONS.find((s) => s.id === "02")?.children.some((c) => c.path === "/pos/salesmen")).toBe(
      false,
    );
    expect(ERP_SIDEBAR_SECTIONS.find((s) => s.id === "02")?.children.some((c) => c.path === "/exchange")).toBe(
      false,
    );
    expect(ERP_SIDEBAR_SECTIONS.find((s) => s.id === "08")?.children.some((c) => c.path === "/credit")).toBe(
      false,
    );
    expect(ERP_SIDEBAR_SECTIONS.find((s) => s.id === "03")?.children.some((c) => c.path === "/qr")).toBe(false);
  });

  it("reuses existing screens for shared children and keeps Coming Soon items as placeholders", () => {
    const child = (id: string, title: string) =>
      ERP_NAV_SECTIONS.find((s) => s.id === id)?.children.find((c) => c.title === title);

    expect(child("02", "Salesman / Reference")?.path).toBe("/pos/salesman-reference");
    expect(child("02", "Installments")?.path).toBe("/pos/installments");
    expect(child("02", "POS Shift")?.path).toBe("/pos/shift");
    expect(child("16", "B2B")?.path).toBe("/b2b");
    expect(child("11", "P&L")?.path).toBe("/accounts/profit-loss");
    expect(child("04", "Price Lists")?.path).toBe("/suppliers/price-lists");

    expect(child("02", "Discounts")?.status).toBe("implemented");
    expect(child("02", "Discounts")?.path).toBe("/discounts");
    expect(child("02", "Coupons")?.status).toBe("implemented");
    expect(child("02", "Offline POS")?.status).toBe("placeholder");

    for (const [id, title] of [
      ["04", "Automation"],
      ["06", "Receiving"],
      ["06", "Dispatch"],
      ["08", "Receivables"],
      ["04", "Payables"],
      ["04", "Performance"],
      ["11", "Cash"],
      ["11", "Receipts"],
      ["39", "Maintenance"],
      ["18", "Coming Soon"],
    ] as const) {
      expect(child(id, title)?.status).toBe("placeholder");
    }
  });

  it("keeps landing children under parents and hides implementation-only aliases", () => {
    const sales = ERP_SIDEBAR_SECTIONS.find((s) => s.id === "02");
    expect(sales?.children).toEqual([]);
    expect(sales?.children.some((c) => c.title === "Hold / Resume" && c.path === "/held-sales")).toBe(false);
    const printing = ERP_SIDEBAR_SECTIONS.find((s) => s.id === "31");
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
      "/product-catalog",
      "/command-center",
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
      screen.getAllByRole("link", { name: "CUSTOMERS / CRM" }).some((link) => link.getAttribute("href") === "/customers"),
    ).toBe(true);
    expect(screen.getByRole("link", { name: "PRODUCT & CATALOG" })).toHaveAttribute(
      "title",
      "PRODUCT & CATALOG",
    );
    expect(screen.getByRole("link", { name: "INDUSTRY ENGINE" })).toHaveAttribute(
      "href",
      "/industry",
    );
    rerender(
      <MemoryRouter initialEntries={["/customers"]}>
        <SidebarNav query="" onNavigate={() => undefined} collapsed />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("ERP modules")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Collapse Customers/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Expand /i })).not.toBeInTheDocument();
  });

  it("finds a parent by official module name without listing every route as a top-level item", () => {
    const view = render(
      <MemoryRouter initialEntries={["/"]}>
        <SidebarNav query="PRODUCT & CATALOG" onNavigate={() => undefined} />
      </MemoryRouter>,
    );
    expect(view.getByRole("link", { name: "PRODUCT & CATALOG" })).toBeInTheDocument();
    expect(view.queryByRole("link", { name: "CUSTOMERS / CRM" })).not.toBeInTheDocument();
  });

  it("filters to a parent when a child feature is typed, without listing that child", () => {
    render(
      <MemoryRouter initialEntries={["/command-center"]}>
        <SidebarNav query="invoice" onNavigate={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "POS / SALES" })).toHaveAttribute("href", "/pos");
    expect(screen.queryByRole("link", { name: "Invoices" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Hold / Resume" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Expand /i })).not.toBeInTheDocument();
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

  it("keeps Salesmen reachable without a global sidebar item", () => {
    expect(ERP_MODULES.some((m) => m.path === "/pos/salesmen")).toBe(true);
    expect(ERP_SIDEBAR_SECTIONS.find((s) => s.id === "02")?.children.some((c) => c.path === "/pos/salesmen")).toBe(
      false,
    );
    render(
      <MemoryRouter initialEntries={["/pos"]}>
        <SidebarNav query="" onNavigate={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: "Salesmen" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "POS / SALES" })).toHaveAttribute("href", "/pos");
    expect(screen.getByRole("link", { name: "HR & PAYROLL" })).toHaveAttribute("href", "/hr");
  });

  it("resolves the ERP header from the official module tree", () => {
    expect(resolveShellHeader("/pos")).toEqual({
      moduleTitle: "POS / SALES",
      pageTitle: "POS Terminal",
    });
    expect(resolveShellHeader("/pos/new")).toEqual({
      moduleTitle: "POS / SALES",
      pageTitle: "POS Terminal",
    });
    expect(resolveShellHeader("/held-sales")).toEqual({
      moduleTitle: "POS / SALES",
      pageTitle: "Resume Sale",
    });
    expect(resolveShellHeader("/pos/resume-sale")).toEqual({
      moduleTitle: "POS / SALES",
      pageTitle: "Resume Sale",
    });
    expect(resolveShellHeader("/invoices")).toEqual({
      moduleTitle: "POS / SALES",
      pageTitle: "Invoices",
    });
    expect(resolveShellHeader("/returns")).toEqual({
      moduleTitle: "POS / SALES",
      pageTitle: "Returns",
    });
    expect(resolveShellHeader("/exchange")).toEqual({
      moduleTitle: "POS / SALES",
      pageTitle: "Exchange",
    });
    expect(resolveShellHeader("/payments")).toEqual({
      moduleTitle: "POS / SALES",
      pageTitle: "Payments",
    });
    expect(resolveShellHeader("/discounts")).toEqual({
      moduleTitle: "POS / SALES",
      pageTitle: "Discounts",
    });
    expect(resolveShellHeader("/products")).toEqual({
      moduleTitle: "PRODUCT & CATALOG",
      pageTitle: "Products",
    });
    expect(resolveShellHeader("/product-catalog")).toEqual({
      moduleTitle: "PRODUCT & CATALOG",
      pageTitle: "Products",
    });
    expect(resolveShellHeader("/command-center")).toEqual({
      moduleTitle: "COMMAND CENTER",
      pageTitle: "Modules",
    });
    expect(resolveShellHeader("/settings")).toEqual({
      moduleTitle: "SYSTEM ADMINISTRATION",
      pageTitle: "Overview",
    });
    expect(resolveShellHeader("/security")).toEqual({
      moduleTitle: "SECURITY / AUDIT",
      pageTitle: "Security",
    });
    expect(resolveShellHeader("/settings/numbering")).toEqual({
      moduleTitle: "SYSTEM ADMINISTRATION",
      pageTitle: "Date & Numbering",
    });
  });

  it("highlights the parent without exposing workspace children globally", () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/invoices"]}>
        <SidebarNav query="" onNavigate={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: "Hold / Resume" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Invoices" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Register" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Returns" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Payments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Discounts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Expand /i })).not.toBeInTheDocument();
    const pos = screen.getByRole("link", { name: "POS / SALES" });
    expect(pos).toHaveAttribute("href", "/pos");
    expect(pos).toHaveAttribute("aria-current", "page");
    expect(pos.className).toContain("min-h-11");
    expect(pos.className).toContain("erp-brand-soft");
    expect(screen.queryByRole("link", { name: "New Sale" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Exchange" })).not.toBeInTheDocument();
    unmount();

    render(
      <MemoryRouter initialEntries={["/pos/invoices"]}>
        <SidebarNav query="" onNavigate={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "POS / SALES" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Invoices" })).not.toBeInTheDocument();
  });

  it("keeps the POS workspace on module 02 instead of a second global nav tree", () => {
    render(
      <MemoryRouter initialEntries={["/pos"]}>
        <SidebarNav query="" onNavigate={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "POS / SALES" })).toHaveAttribute("href", "/pos");
    expect(screen.queryByRole("link", { name: "New Sale" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Hold / Resume" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Payments" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "COMMAND CENTER" })).toHaveAttribute("href", "/command-center");
  });

  it("keeps System Administration as module 39 with a control-center workspace", () => {
    expect(ERP_NAV_SECTIONS[38]?.id).toBe("39");
    expect(ERP_NAV_SECTIONS[38]?.masterTitle).toBe("SYSTEM ADMINISTRATION");
    expect(ERP_MODULES.find((m) => m.path === "/settings")?.status).toBe("implemented");
    expect(isSystemAdminPath("/settings")).toBe(true);
    expect(isSystemAdminPath("/security")).toBe(false);
    expect(isSystemAdminPath("/integrations")).toBe(false);
    expect(isSystemAdminPath("/online-store")).toBe(false);
    expect(isSystemAdminPath("/hr")).toBe(false);
    expect(isSystemAdminPath("/mobile")).toBe(false);
    expect(isSystemAdminPath("/settings/company")).toBe(true);
    expect(isSystemAdminPath("/pos")).toBe(false);

    expect(isValidElement(IMPLEMENTED_ROUTES["/security"])).toBe(true);
    expect(isValidElement(IMPLEMENTED_ROUTES["/integrations"])).toBe(true);
    expect(isValidElement(IMPLEMENTED_ROUTES["/online-store"])).toBe(true);
    expect(isValidElement(IMPLEMENTED_ROUTES["/hr"])).toBe(true);
    expect(isValidElement(IMPLEMENTED_ROUTES["/settings"])).toBe(true);

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <AuthProvider>
          <ModuleWorkspace>
            <div>Settings workspace</div>
          </ModuleWorkspace>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("navigation", { name: "SYSTEM ADMINISTRATION workspace" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("link", { name: /Company/ })).toHaveAttribute("href", "/settings/company");
    expect(screen.queryByRole("link", { name: "Security" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "HR" })).not.toBeInTheDocument();
    expect(screen.getByText("Settings workspace")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "ERP modules" })).not.toBeInTheDocument();
    const sysNav = screen.getByRole("navigation", { name: "SYSTEM ADMINISTRATION workspace" });
    expect(sysNav.firstElementChild?.className).toContain("overflow-x-auto");
    expect(sysNav.firstElementChild?.className).toContain("md:flex-wrap");
    expect(sysNav.firstElementChild?.className).toContain("md:overflow-visible");

    cleanup();
    render(
      <MemoryRouter>
        <SystemAdminHome />
      </MemoryRouter>,
    );
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText(/Coming Soon/i)).toBeInTheDocument();
    expect(screen.getAllByText("Live").length).toBeGreaterThanOrEqual(3);
  });

  it("wraps official parent labels and shows module numbers 01–39", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SidebarNav query="" onNavigate={() => undefined} />
      </MemoryRouter>,
    );
    expect(document.querySelectorAll("[data-erp-module]")).toHaveLength(39);
    for (const name of [
      "COMMAND CENTER",
      "TAX / FBR",
      "BACKUP / DISASTER RECOVERY",
      "USERS / ROLES / PERMISSIONS",
      "RULES / AUTOMATION ENGINE",
      "SYSTEM ADMINISTRATION",
    ]) {
      const link = screen.getByRole("link", { name });
      const label = link.querySelector("[data-erp-label]");
      expect(label?.textContent).toBe(name);
      expect(label?.className).not.toContain("truncate");
    }
    expect(document.querySelector('[data-erp-module="01"]')?.textContent).toContain("01");
    expect(document.querySelector('[data-erp-module="39"]')?.textContent).toContain("39");
  });

  it("closes the shared drawer callback when a parent is opened", () => {
    const onNavigate = vi.fn();
    render(
      <MemoryRouter initialEntries={["/customers"]}>
        <SidebarNav query="" onNavigate={onNavigate} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("link", { name: "POS / SALES" }));
    expect(onNavigate).toHaveBeenCalled();
  });

  it("highlights the parent for deep-linked children without opening a nested tree", () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/security"]}>
        <SidebarNav query="" onNavigate={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "SECURITY / AUDIT" }).className).toContain(
      "erp-brand-soft",
    );
    unmount();

    render(
      <MemoryRouter initialEntries={["/exchange"]}>
        <SidebarNav query="" onNavigate={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "POS / SALES" }).className).toContain("erp-brand-soft");
    expect(findSectionForPath("/pos/invoices")?.id).toBe("02");
    expect(findSectionForPath("/invoices")?.id).toBe("02");
    expect(findSectionForPath("/held-sales")?.id).toBe("02");
  });
});

describe("responsive ERP shell", () => {
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    })) as typeof window.matchMedia;
  });

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
    expect(shell.getAttribute("data-erp-viewport")).toMatch(/^(mobile|tablet|desktop)$/);
    expect(shell.getAttribute("data-erp-nav")).toMatch(/^(drawer|drawer-open|collapsed|expanded)$/);
    expect(screen.getByRole("button", { name: "Menu" }).className).toContain("md:hidden");
    expect(screen.getByRole("button", { name: "Collapse sidebar" }).className).toContain("md:inline-flex");
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("button", { name: "Close navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.getAllByLabelText("ERP modules")).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Hold / Resume" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Invoices" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Expand /i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "POS / SALES" }).className).toContain("min-h-11");
    for (const section of ERP_NAV_SECTIONS) {
      const matches = screen
        .getAllByRole("link", { name: section.masterTitle })
        .filter((link) => link.getAttribute("href") === section.path);
      expect(matches.length).toBeGreaterThan(0);
    }
    fireEvent.click(screen.getByRole("link", { name: "POS / SALES" }));
    expect(screen.queryByRole("button", { name: "Close navigation" })).not.toBeInTheDocument();
  }, 30_000);

  it("opens every parent module inside the same ERP AppShell", () => {
    for (const path of ERP_STABLE_PARENT_PATHS) {
      const { unmount } = renderShell(path);
      expect(screen.getByLabelText("ERP modules"), path).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Menu" }), path).toBeInTheDocument();
      if (isPosEnvironmentPath(path)) {
        expect(screen.getByLabelText("POS Branch"), path).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "POS Notifications" }), path).toHaveAttribute(
          "href",
          "/notifications",
        );
        expect(screen.getByLabelText("POS navigation"), path).toBeInTheDocument();
        expect(screen.queryByRole("navigation", { name: "Breadcrumb" }), path).not.toBeInTheDocument();
      } else {
        expect(screen.getByRole("combobox", { name: "Branch" }), path).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Notifications" }), path).toHaveAttribute("href", "/notifications");
        expect(screen.getByRole("navigation", { name: "Breadcrumb" }), path).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "User" }), path).toBeInTheDocument();
      }
      expect(screen.queryByRole("link", { name: "ERP Home" }), path).not.toBeInTheDocument();
      unmount();
    }
  }, 60_000);

  it("opens POS operational routes inside the same ERP AppShell", () => {
    const { unmount } = renderShell("/pos");
    expect(screen.getByLabelText("ERP modules")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "POS / SALES" })).toHaveAttribute("href", "/pos");
    expect(screen.getByRole("link", { name: "COMMAND CENTER" })).toHaveAttribute("href", "/command-center");
    expect(screen.queryByRole("link", { name: "ERP Home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "POS / SALES workspace" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "POS / SALES" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Cashier")).toBeInTheDocument();
    expect(screen.getByLabelText("Shift Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Date / Time")).toBeInTheDocument();
    expect(screen.getByLabelText("POS Branch")).toBeInTheDocument();
    expect(screen.getByLabelText("POS navigation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Held Sales" })).toHaveAttribute("href", "/pos/resume-sale");
    expect(screen.getByRole("link", { name: "POS Notifications" })).toHaveAttribute("href", "/notifications");
    expect(screen.getByLabelText("POS User")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    const terminalNav = screen.getByLabelText("POS navigation");
    expect(within(terminalNav).getByRole("link", { name: "POS" })).toHaveAttribute("href", "/pos");
    expect(within(terminalNav).getByRole("link", { name: "POS" })).toHaveAttribute("aria-current", "page");
    expect(within(terminalNav).getByRole("link", { name: "Resume Sale" })).toHaveAttribute(
      "href",
      "/pos/resume-sale",
    );
    expect(within(terminalNav).getByRole("link", { name: "Customers" })).toHaveAttribute(
      "href",
      "/pos/customer-selection",
    );
    expect(within(terminalNav).getByRole("link", { name: "Price & Discount" })).toHaveAttribute("href", "/discounts");
    expect(POS_IA_TITLES).toHaveLength(26);
    unmount();

    renderShell("/invoices");
    expect(screen.getByLabelText("ERP modules")).toBeInTheDocument();
    expect(screen.getByLabelText("POS navigation")).toBeInTheDocument();
    expect(screen.getByLabelText("POS status")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "POS / SALES workspace" })).not.toBeInTheDocument();
    expect(screen.getByText("workspace")).toBeInTheDocument();
    cleanup();

    renderShell("/pos/salesmen");
    expect(screen.getByLabelText("ERP modules")).toBeInTheDocument();
    expect(screen.getByLabelText("POS navigation")).toBeInTheDocument();
    expect(screen.getByText("workspace")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ERP Home" })).not.toBeInTheDocument();
    cleanup();

    renderShell("/salesman");
    expect(screen.getByLabelText("ERP modules")).toBeInTheDocument();
    expect(screen.queryByLabelText("POS navigation")).not.toBeInTheDocument();
  }, 20_000);
});
