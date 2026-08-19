import {
  COMPAT_ALIAS_PATHS,
  ERP_MODULE_REGISTRY,
  ERP_MODULES,
  ERP_STABLE_PARENT_PATHS,
  isCommandPaletteChild,
  type ErpNavSection,
  type NavIconName,
  type NavStatus,
} from "@/app/modules";

export interface LauncherModule {
  id: string;
  number: string;
  name: string;
  path: string;
  icon: NavIconName;
  description: string;
  status: NavStatus;
  permission?: string;
  children: Array<{ title: string; path: string }>;
}

export interface LauncherSearchHit {
  module: LauncherModule;
  matchedChildren: Array<{ title: string; path: string }>;
}

export interface LauncherSuggestion {
  id: string;
  moduleNumber: string;
  moduleName: string;
  modulePath: string;
  childTitle?: string;
  href: string;
}

function searchableChildren(section: ErpNavSection): Array<{ title: string; path: string }> {
  return section.children
    .filter((child) => isCommandPaletteChild(section, child) && !COMPAT_ALIAS_PATHS.has(child.path))
    .map((child) => ({ title: child.title, path: child.path }));
}

/**
 * 39 launcher cards. Paths and copy come from ERP_MODULES; numbers, icons,
 * and child features come from the module registry. Do not hardcode cards.
 */
export function launcherModules(
  sections: readonly ErpNavSection[] = ERP_MODULE_REGISTRY,
  routes: readonly { path: string; title: string; description: string; status?: NavStatus; permission?: string }[] = ERP_MODULES,
): LauncherModule[] {
  const byPath = new Map(routes.map((route) => [route.path, route]));
  return sections.map((section) => {
    const route = byPath.get(section.path);
    return {
      id: section.id,
      number: section.number,
      name: route?.title ?? section.name,
      path: section.path,
      icon: section.icon,
      description: route?.description ?? section.description,
      status: route?.status ?? section.status,
      permission: route?.permission ?? section.permission,
      children: searchableChildren(section),
    };
  });
}

export function launcherParentPaths(): readonly string[] {
  return launcherModules().map((module) => module.path);
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function numberMatches(number: string, query: string): boolean {
  if (!/^\d+$/.test(query)) return false;
  const padded = query.padStart(2, "0");
  return number === query || number === padded;
}

function textMatches(value: string, query: string): boolean {
  return value.toLowerCase().includes(query);
}

export function filterLauncherModules(query: string, modules: LauncherModule[] = launcherModules()): LauncherSearchHit[] {
  const q = normalizeQuery(query);
  if (!q) {
    return modules.map((module) => ({ module, matchedChildren: [] }));
  }

  const hits: LauncherSearchHit[] = [];
  for (const module of modules) {
    const parentHit =
      numberMatches(module.number, q) ||
      textMatches(module.name, q) ||
      textMatches(module.description, q) ||
      textMatches(module.path, q);
    const matchedChildren = module.children.filter(
      (child) => textMatches(child.title, q) || textMatches(child.path, q),
    );
    if (parentHit || matchedChildren.length) {
      hits.push({ module, matchedChildren });
    }
  }
  return hits;
}

export function launcherSuggestions(query: string, modules: LauncherModule[] = launcherModules()): LauncherSuggestion[] {
  const q = normalizeQuery(query);
  if (!q) return [];

  const suggestions: LauncherSuggestion[] = [];
  for (const { module, matchedChildren } of filterLauncherModules(q, modules)) {
    const parentHit =
      numberMatches(module.number, q) ||
      textMatches(module.name, q) ||
      textMatches(module.description, q) ||
      textMatches(module.path, q);

    if (parentHit) {
      const nameOrNumber = numberMatches(module.number, q) || textMatches(module.name, q);
      if (nameOrNumber || matchedChildren.length === 0) {
        suggestions.push({
          id: `parent:${module.path}`,
          moduleNumber: module.number,
          moduleName: module.name,
          modulePath: module.path,
          href: module.path,
        });
        continue;
      }
    }

    for (const child of matchedChildren) {
      suggestions.push({
        id: `child:${module.path}:${child.path}:${child.title}`,
        moduleNumber: module.number,
        moduleName: module.name,
        modulePath: module.path,
        childTitle: child.title,
        href: child.path,
      });
    }
  }
  return suggestions;
}

export function assertLauncherCoversParents(): boolean {
  const paths = launcherParentPaths();
  return paths.length === ERP_STABLE_PARENT_PATHS.length && paths.every((path, index) => path === ERP_STABLE_PARENT_PATHS[index]);
}
