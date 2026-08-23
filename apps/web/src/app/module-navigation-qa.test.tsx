import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useLocation, useNavigate, MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@electronic-erp/ui";
import {
  ERP_FEATURE_FOLDERS,
  ERP_MODULES,
  ERP_NAV_SECTIONS,
  ERP_SIDEBAR_SECTIONS,
  ERP_STABLE_PARENT_PATHS,
  findSectionForPath,
  isComingSoonEngineSection,
  isPosEnvironmentPath,
  isWorkspaceNavChild,
  resolveShellHeader,
} from "@/app/modules";
import { AppShell } from "@/app/shell/AppShell";
import { resolveModuleWorkspace } from "@/app/shell/module-workspace";
import { AuthProvider } from "@/features/auth/AuthContext";
import { authService, authStorage } from "@/features/auth/auth-service";
import { NavIcon } from "@/app/shell/nav-icons";
import { launcherModules } from "@/features/dashboard/module-launcher";
import { elementForModulePath, IMPLEMENTED_ROUTES } from "@/app/router";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.spyOn(authStorage, "getToken").mockReturnValue("qa-token");
  vi.spyOn(authService, "restore").mockResolvedValue(null);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ items: [], total: 0 }),
    })),
  );
});

const OFFICIAL_PARENTS = [
  { id: "01", name: "COMMAND CENTER", path: "/command-center" },
  { id: "02", name: "POS / SALES", path: "/pos" },
  { id: "03", name: "PRODUCT & CATALOG", path: "/product-catalog" },
  { id: "04", name: "PURCHASING", path: "/purchasing" },
  { id: "05", name: "INVENTORY", path: "/inventory" },
  { id: "06", name: "WAREHOUSE / WMS", path: "/warehouse" },
  { id: "07", name: "DELIVERY / LOGISTICS", path: "/delivery" },
  { id: "08", name: "CUSTOMERS / CRM", path: "/customers" },
  { id: "09", name: "SERVICE MANAGEMENT", path: "/service" },
  { id: "10", name: "WARRANTY", path: "/warranty" },
  { id: "11", name: "ACCOUNTS & FINANCE", path: "/accounts" },
  { id: "12", name: "BANKING & PAYMENTS", path: "/banking" },
  { id: "13", name: "REPORTS & BUSINESS INTELLIGENCE", path: "/reports" },
  { id: "14", name: "AI & AUTOMATION", path: "/ai" },
  { id: "15", name: "MARKETING & LOYALTY", path: "/marketing" },
  { id: "16", name: "B2B / WHOLESALE", path: "/b2b" },
  { id: "17", name: "ONLINE STORE", path: "/online-store" },
  { id: "18", name: "MOBILE", path: "/mobile" },
  { id: "19", name: "ORGANIZATION / BRANCHES", path: "/organization" },
  { id: "20", name: "HR & PAYROLL", path: "/hr" },
  { id: "21", name: "TAX / FBR", path: "/tax" },
  { id: "22", name: "DOCUMENT MANAGEMENT", path: "/documents" },
  { id: "23", name: "WORKFLOW / APPROVALS", path: "/workflows" },
  { id: "24", name: "NOTIFICATIONS", path: "/notifications" },
  { id: "25", name: "USERS / ROLES / PERMISSIONS", path: "/users" },
  { id: "26", name: "SECURITY / AUDIT", path: "/security" },
  { id: "27", name: "OFFLINE / LOCAL OPERATIONS", path: "/offline" },
  { id: "28", name: "SYNC CENTER", path: "/sync" },
  { id: "29", name: "BACKUP / DISASTER RECOVERY", path: "/backup" },
  { id: "30", name: "INTEGRATION HUB", path: "/integrations" },
  { id: "31", name: "DEVICES / PRINTING", path: "/devices" },
  { id: "32", name: "INDUSTRY ENGINE", path: "/industry" },
  { id: "33", name: "CUSTOMIZATION ENGINE", path: "/customization" },
  { id: "34", name: "RULES / AUTOMATION ENGINE", path: "/automation" },
  { id: "35", name: "CLIENT / TENANT MANAGEMENT", path: "/tenants" },
  { id: "36", name: "SUBSCRIPTION / BILLING", path: "/subscription" },
  { id: "37", name: "USAGE / METERING", path: "/usage" },
  { id: "38", name: "DEVELOPER PLATFORM", path: "/developer" },
  { id: "39", name: "SYSTEM ADMINISTRATION", path: "/settings" },
] as const;

function ErpPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <span data-testid="erp-location">{pathname}</span>
      <button type="button" onClick={() => navigate(-1)}>
        History back
      </button>
      {elementForModulePath(pathname)}
    </>
  );
}

function renderErp(path: string | string[], index?: number) {
  const entries = Array.isArray(path) ? path : [path];
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={index ?? entries.length - 1}>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="*" element={<ErpPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

function parentLink(name: string, href: string) {
  return screen.getAllByRole("link", { name }).find((link) => link.getAttribute("href") === href);
}

describe("39-module navigation QA", () => {
  it("registers exactly 39 parents with number, name, icon, route, description, children, and ownership", () => {
    expect(ERP_NAV_SECTIONS).toHaveLength(39);
    expect(ERP_SIDEBAR_SECTIONS).toHaveLength(39);
    expect(ERP_STABLE_PARENT_PATHS).toHaveLength(39);
    expect(launcherModules()).toHaveLength(39);
    expect(ERP_FEATURE_FOLDERS).toHaveLength(39);

    const claimed = new Map<string, string>();
    for (const [index, expected] of OFFICIAL_PARENTS.entries()) {
      const section = ERP_NAV_SECTIONS[index];
      expect(section?.id, expected.id).toBe(expected.id);
      expect(section?.number, expected.id).toBe(expected.id);
      expect(section?.name, expected.id).toBe(expected.name);
      expect(section?.masterTitle, expected.id).toBe(expected.name);
      expect(section?.title, expected.id).toBe(expected.name);
      expect(section?.path, expected.id).toBe(expected.path);
      expect(section?.icon, expected.id).toBeTruthy();
      expect(section?.description.trim().length, expected.id).toBeGreaterThan(0);
      expect(section?.permission, expected.id).toBeTruthy();
      expect(section?.featureOwnership, expected.id).toBe(section?.folder);
      expect(Array.isArray(section?.children), expected.id).toBe(true);
      expect(section?.children.length, expected.id).toBeGreaterThan(0);
      expect(ERP_FEATURE_FOLDERS[index]?.folder, expected.id).toBe(section?.folder);
      expect(() => render(<NavIcon name={section!.icon} />)).not.toThrow();
      cleanup();

      const prev = claimed.get(section!.path);
      expect(prev, `${section!.path} claimed twice`).toBeUndefined();
      claimed.set(section!.path, section!.id);
      for (const child of section!.children) {
        expect(child.title.trim().length, child.path).toBeGreaterThan(0);
        expect(child.description.trim().length, child.path).toBeGreaterThan(0);
        expect(child.path.startsWith("/"), child.path).toBe(true);
        const owner = claimed.get(child.path);
        if (owner && owner !== section!.id) {
          throw new Error(`${child.path} is owned by ${owner} and ${section!.id}`);
        }
        claimed.set(child.path, section!.id);
      }
    }

    expect(isComingSoonEngineSection({ id: "18" })).toBe(true);
    expect(isComingSoonEngineSection({ id: "39" })).toBe(false);
    for (const id of ["18", "27", "28", "32", "33", "34", "35", "36", "37", "38"]) {
      const section = ERP_NAV_SECTIONS.find((row) => row.id === id);
      expect(section?.status, id).toBe("placeholder");
      expect(ERP_SIDEBAR_SECTIONS.some((row) => row.id === id && row.path === section?.path), id).toBe(true);
    }
  });

  it("keeps every parent and child registered and owned by one module", () => {
    const modulePaths = new Set(ERP_MODULES.map((item) => item.path));
    for (const section of ERP_NAV_SECTIONS) {
      expect(modulePaths.has(section.path), section.path).toBe(true);
      expect(findSectionForPath(section.path)?.id, section.path).toBe(section.id);
      expect(resolveModuleWorkspace(section.path)?.id, section.path).toBe(section.id);
      expect(resolveShellHeader(section.path).moduleTitle, section.path).toBe(section.name);
      for (const child of section.children) {
        expect(modulePaths.has(child.path), child.path).toBe(true);
        expect(findSectionForPath(child.path)?.id, child.path).toBe(section.id);
        expect(elementForModulePath(child.path), child.path).toBeTruthy();
        if (child.status === "implemented") {
          expect(IMPLEMENTED_ROUTES[child.path], child.path).toBeTruthy();
        }
      }
      for (const alias of section.aliases) {
        expect(modulePaths.has(alias), alias).toBe(true);
        expect(findSectionForPath(alias)?.id, alias).toBe(section.id);
      }
    }
  });

  it("opens every parent module card inside the same ERP shell", () => {
    for (const section of ERP_NAV_SECTIONS) {
      const { unmount } = renderErp(section.path);
      expect(screen.getByTestId("erp-location").textContent, section.path).toBe(section.path);
      if (isPosEnvironmentPath(section.path)) {
        expect(screen.getByRole("button", { name: "Menu" }), section.path).toBeInTheDocument();
      } else {
        expect(screen.getByLabelText("ERP modules"), section.path).toBeInTheDocument();
        expect(screen.getAllByLabelText("ERP modules"), section.path).toHaveLength(1);
      }
      expect(screen.queryByRole("link", { name: "ERP Home" }), section.path).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Page not found" }), section.path).not.toBeInTheDocument();
      expect(document.querySelector(`[data-module-workspace="${section.id}"]`), section.path).toBeTruthy();
      if (!isPosEnvironmentPath(section.path)) {
        expect(parentLink(section.masterTitle, section.path), section.path).toHaveAttribute("aria-current", "page");
      }

      if (isPosEnvironmentPath(section.path)) {
        expect(document.querySelector("[data-erp-workspace-layout='pos-workspace']"), section.path).toBeTruthy();
        expect(screen.queryByRole("heading", { level: 1, name: section.name }), section.path).not.toBeInTheDocument();
        expect(
          screen.queryByRole("navigation", { name: `${section.name} workspace` }),
          section.path,
        ).not.toBeInTheDocument();
        expect(screen.getByLabelText("POS navigation"), section.path).toBeInTheDocument();
      } else {
        expect(screen.getByRole("heading", { level: 1, name: section.name }), section.path).toBeInTheDocument();
        expect(screen.getByRole("navigation", { name: `${section.name} workspace` }), section.path).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Overview" }), section.path).toHaveAttribute("href", section.path);

        const workspace = screen.getByRole("navigation", { name: `${section.name} workspace` });
        for (const child of section.children.filter((item) => isWorkspaceNavChild(section, item))) {
          expect(
            within(workspace)
              .getAllByRole("link")
              .some((link) => link.getAttribute("href") === child.path && link.textContent?.includes(child.title)),
            child.path,
          ).toBe(true);
        }
      }

      if (section.status === "placeholder") {
        expect(screen.getAllByText(/Coming Soon/i).length, section.path).toBeGreaterThan(0);
        expect(screen.queryByText(/Module not yet implemented/i), section.path).toBeTruthy();
      } else {
        expect(IMPLEMENTED_ROUTES[section.path], section.path).toBeTruthy();
      }

      unmount();
    }
  }, 120_000);

  it("opens every child page in the owning module workspace without a second shell", () => {
    for (const section of ERP_NAV_SECTIONS) {
      for (const child of section.children) {
        if (child.path === section.path) continue;
        const { unmount } = renderErp(child.path);
        const location = screen.getByTestId("erp-location").textContent ?? "";
        expect(location, child.path).toBe(child.path);
        if (isPosEnvironmentPath(child.path)) {
          expect(screen.getByRole("button", { name: "Menu" }), child.path).toBeInTheDocument();
        } else {
          expect(screen.getByLabelText("ERP modules"), child.path).toBeInTheDocument();
          expect(screen.getAllByLabelText("ERP modules"), child.path).toHaveLength(1);
        }
        expect(screen.queryByRole("heading", { name: "Page not found" }), child.path).not.toBeInTheDocument();
        expect(document.querySelector(`[data-module-workspace="${section.id}"]`), child.path).toBeTruthy();
        if (!isPosEnvironmentPath(child.path)) {
          expect(parentLink(section.masterTitle, section.path), child.path).toHaveAttribute("aria-current", "page");
        }

        if (isPosEnvironmentPath(child.path)) {
          expect(document.querySelector("[data-erp-workspace-layout='pos-workspace']"), child.path).toBeTruthy();
          expect(screen.queryByRole("heading", { level: 1, name: section.name }), child.path).not.toBeInTheDocument();
          expect(
            screen.queryByRole("navigation", { name: `${section.name} workspace` }),
            child.path,
          ).not.toBeInTheDocument();
          expect(screen.getByLabelText("POS navigation"), child.path).toBeInTheDocument();
        } else {
          expect(screen.getByRole("heading", { level: 1, name: section.name }), child.path).toBeInTheDocument();
          expect(
            screen.getByRole("navigation", { name: `${section.name} workspace` }),
            child.path,
          ).toBeInTheDocument();
        }

        if (child.status === "placeholder") {
          if (isPosEnvironmentPath(child.path) && IMPLEMENTED_ROUTES[child.path]) {
            expect(screen.getByRole("heading", { level: 1 }), child.path).toBeInTheDocument();
          } else {
            const staged =
              screen.queryAllByText(/Coming Soon/i).length > 0 ||
              screen.queryAllByText(/\bSoon\b/i).length > 0 ||
              screen.queryAllByText(/not available online yet/i).length > 0 ||
              screen.queryAllByText(/Staged/i).length > 0 ||
              screen.queryAllByText(/Offline POS/i).length > 0;
            expect(staged, child.path).toBe(true);
          }
        }
        unmount();
      }
    }
  }, 180_000);

  it("keeps launcher cards, browser back, and refresh on the same ERP architecture", () => {
    const { unmount } = renderErp("/command-center");
    const cards = screen.getAllByRole("link", { name: /Open Module/i });
    expect(cards).toHaveLength(39);
    expect(cards.map((card) => card.getAttribute("href"))).toEqual([...ERP_STABLE_PARENT_PATHS]);
    const posCard = document.querySelector('[data-launcher-module="02"]');
    expect(posCard).toBeTruthy();
    fireEvent.click(posCard!);
    expect(screen.getByTestId("erp-location")).toHaveTextContent("/pos");
    expect(screen.getByLabelText("POS navigation")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "POS / SALES" })).not.toBeInTheDocument();
    expect(document.querySelector("[data-erp-workspace-layout='pos-workspace']")).toBeTruthy();
    expect(screen.getByTestId("pos-command-center")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "History back" }));
    expect(screen.getByTestId("erp-location")).toHaveTextContent("/command-center");
    expect(screen.getByRole("heading", { level: 1, name: "COMMAND CENTER" })).toBeInTheDocument();
    unmount();

    renderErp("/offline");
    expect(screen.getByRole("heading", { level: 1, name: "OFFLINE / LOCAL OPERATIONS" })).toBeInTheDocument();
    expect(screen.getByText(/Module not yet implemented/i)).toBeInTheDocument();
    cleanup();
    renderErp("/offline");
    expect(screen.getByTestId("erp-location")).toHaveTextContent("/offline");
    expect(screen.getByRole("heading", { level: 1, name: "OFFLINE / LOCAL OPERATIONS" })).toBeInTheDocument();
    expect(parentLink("OFFLINE / LOCAL OPERATIONS", "/offline")).toHaveAttribute("aria-current", "page");
  }, 30_000);
});
