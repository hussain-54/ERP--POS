import { describe, expect, it } from "vitest";
import { ERP_NAV_SECTIONS, ERP_STABLE_PARENT_PATHS } from "@/app/modules";
import {
  filterWorkspaceNav,
  isWorkspaceNavItemActive,
  resolveModuleWorkspace,
  workspaceNavItems,
} from "./module-workspace";

describe("module workspace model", () => {
  it("builds workspace data from the module registry for every parent", () => {
    for (const path of ERP_STABLE_PARENT_PATHS) {
      const model = resolveModuleWorkspace(path);
      const section = ERP_NAV_SECTIONS.find((row) => row.path === path);
      expect(model, path).toBeTruthy();
      expect(model?.path).toBe(path);
      expect(model?.name).toBe(section?.name);
      expect(model?.icon).toBe(section?.icon);
      expect(model?.nav[0]).toMatchObject({ title: "Overview", path });
    }
  });

  it("lists POS / SALES as a placeholder workspace", () => {
    const model = resolveModuleWorkspace("/pos");
    expect(model?.name).toBe("POS / SALES");
    expect(model?.searchPlaceholder).toBe("Search sales...");
    expect(model?.description).toContain("Point of sale");
    expect(model?.nav.map((item) => item.title)).toEqual(["Overview"]);
    expect(isWorkspaceNavItemActive(model!.nav[0]!, "/pos", model!)).toBe(true);
    expect(filterWorkspaceNav("overview", model!.nav).map((item) => item.title)).toEqual(["Overview"]);
  });

  it("keeps System Administration overview plus settings children", () => {
    const section = ERP_NAV_SECTIONS.find((row) => row.id === "39")!;
    const titles = workspaceNavItems(section).map((item) => item.title);
    expect(titles[0]).toBe("Overview");
    expect(titles).toContain("Company");
    expect(titles).toContain("Date & Numbering");
    expect(resolveModuleWorkspace("/settings/company")?.id).toBe("39");
  });
});
