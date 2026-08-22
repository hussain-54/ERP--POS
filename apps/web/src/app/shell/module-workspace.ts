import {
  ERP_MODULES,
  findSectionForPath,
  isNavChildActive,
  isWorkspaceNavChild,
  type ErpNavChild,
  type ErpNavSection,
  type NavIconName,
  type NavStatus,
} from "@/app/modules";

export interface WorkspaceNavItem {
  id: string;
  title: string;
  path: string;
  status: NavStatus;
  permission?: string;
}

export interface ModuleWorkspaceModel {
  id: string;
  number: string;
  name: string;
  description: string;
  icon: NavIconName;
  path: string;
  searchPlaceholder: string;
  nav: WorkspaceNavItem[];
}

function searchPlaceholder(name: string): string {
  const afterSlash = name.split("/")[1]?.trim();
  const source = afterSlash || name.replace(/&/g, " ");
  const word = source.split(/\s+/).find((part) => part.length > 0) ?? "module";
  return `Search ${word.toLowerCase()}...`;
}

export function workspaceNavItems(section: ErpNavSection): WorkspaceNavItem[] {
  const items: WorkspaceNavItem[] = [
    {
      id: `overview:${section.path}`,
      title: "Overview",
      path: section.path,
      status: section.status,
      permission: section.permission,
    },
  ];
  for (const child of section.children) {
    if (!isWorkspaceNavChild(section, child)) continue;
    items.push({
      id: `${child.path}:${child.title}`,
      title: child.title,
      path: child.path,
      status: child.status,
      permission: child.permission ?? section.permission,
    });
  }
  return items;
}

export function resolveModuleWorkspace(pathname: string): ModuleWorkspaceModel | null {
  const section = findSectionForPath(pathname);
  if (!section) return null;
  const route = ERP_MODULES.find((item) => item.path === section.path);
  return {
    id: section.id,
    number: section.number,
    name: section.name,
    description: route?.description ?? section.description,
    icon: section.icon,
    path: section.path,
    searchPlaceholder: searchPlaceholder(section.name),
    nav: workspaceNavItems(section),
  };
}

export function isWorkspaceNavItemActive(
  item: WorkspaceNavItem,
  pathname: string,
  model: Pick<ModuleWorkspaceModel, "path" | "nav">,
): boolean {
  const features = model.nav.filter((row) => row.title !== "Overview");
  const child: Pick<ErpNavChild, "path"> = { path: item.path };
  if (item.title === "Overview") {
    const featureHit = features.some((row) => isNavChildActive({ path: row.path }, pathname) || row.path === pathname);
    if (featureHit) return false;
    return pathname === model.path || pathname === item.path;
  }
  if (isNavChildActive(child, pathname) || item.path === pathname) return true;
  return item.path !== "/" && pathname.startsWith(`${item.path}/`);
}

export function filterWorkspaceNav(query: string, items: WorkspaceNavItem[]): WorkspaceNavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => item.title.toLowerCase().includes(q) || item.path.toLowerCase().includes(q));
}
