import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SearchInput } from "@electronic-erp/ui";
import { canShowNavItem } from "@/app/modules";
import { NavIcon } from "@/app/shell/nav-icons";
import { useAuth } from "@/features/auth/AuthContext";
import {
  filterLauncherModules,
  launcherModules,
  launcherSuggestions,
  type LauncherModule,
} from "./module-launcher";

function ModuleCard({
  module,
  childHints,
}: {
  module: LauncherModule;
  childHints: Array<{ title: string; path: string }>;
}) {
  return (
    <Link
      to={module.path}
      data-launcher-module={module.id}
      className="flex min-h-11 flex-col rounded-[var(--erp-radius-lg)] border border-[var(--erp-border)] bg-[var(--erp-surface)] p-4 shadow-[var(--erp-shadow)] transition hover:border-[var(--erp-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-ring)] active:border-[var(--erp-brand)] active:bg-[var(--erp-brand-soft)]"
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--erp-brand-soft)] text-[var(--erp-brand)] [&_svg]:h-5 [&_svg]:w-5">
        <NavIcon name={module.icon} />
      </span>
      <span className="mt-3 text-xs font-semibold tracking-wide text-[var(--erp-muted)]">{module.number}</span>
      <span className="mt-0.5 text-base font-semibold leading-snug text-[var(--erp-ink)]">{module.name}</span>
      <span className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--erp-muted)]">{module.description}</span>
      {childHints.length ? (
        <span className="mt-3 space-y-1 text-sm text-[var(--erp-brand)]">
          {childHints.slice(0, 3).map((child) => (
            <span key={`${child.path}:${child.title}`} className="block">
              → {child.title}
            </span>
          ))}
        </span>
      ) : null}
      <span className="mt-auto pt-3 text-sm font-semibold text-[var(--erp-brand)]">Open Module →</span>
    </Link>
  );
}

export function ModuleLauncherPage() {
  const { hasPermission, permissions } = useAuth();
  const grantedCount = permissions.length;
  const [query, setQuery] = useState("");

  const allowed = useMemo(
    () =>
      launcherModules().filter((module) => canShowNavItem(module.permission, grantedCount, hasPermission)),
    [grantedCount, hasPermission],
  );

  const visible = useMemo(() => filterLauncherModules(query, allowed), [allowed, query]);
  const suggestions = useMemo(() => launcherSuggestions(query, allowed), [allowed, query]);

  return (
    <div className="mx-auto w-full max-w-[88rem]">
      <div className="max-w-xl">
        <SearchInput
          aria-label="Search modules"
          placeholder="Search modules, numbers, or features…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11"
        />
      </div>

      {query.trim() ? (
        <div className="mt-4" aria-live="polite">
          {suggestions.length ? (
            <ul
              aria-label="Module search results"
              className="divide-y divide-[var(--erp-border)] overflow-hidden rounded-[var(--erp-radius-lg)] border border-[var(--erp-border)] bg-[var(--erp-surface)] shadow-[var(--erp-shadow)]"
            >
              {suggestions.map((item) => (
                <li key={item.id}>
                  <Link
                    to={item.href}
                    className="flex min-h-11 items-center justify-between gap-3 px-4 py-2.5 hover:bg-[var(--erp-brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-ring)] active:bg-[var(--erp-brand-soft)]"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--erp-ink)]">
                        {item.moduleNumber} {item.moduleName}
                      </span>
                      {item.childTitle ? (
                        <span className="mt-0.5 block text-sm text-[var(--erp-brand)]">→ {item.childTitle}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-[var(--erp-brand)]">Open →</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--erp-muted)]">No modules match “{query.trim()}”.</p>
          )}
        </div>
      ) : null}

      <div
        data-launcher-grid
        className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {visible.map(({ module, matchedChildren }) => (
          <ModuleCard key={module.id} module={module} childHints={query.trim() ? matchedChildren : []} />
        ))}
      </div>
    </div>
  );
}
