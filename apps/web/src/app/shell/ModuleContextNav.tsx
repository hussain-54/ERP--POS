import { useRef, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import {
  isWorkspaceNavItemActive,
  type ModuleWorkspaceModel,
  type WorkspaceNavItem,
} from "@/app/shell/module-workspace";

export function ModuleContextNav({
  model,
  items,
  pathname,
}: {
  model: ModuleWorkspaceModel;
  items: WorkspaceNavItem[];
  pathname: string;
}) {
  const navRef = useRef<HTMLElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    const links = [...(navRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-workspace-nav]") ?? [])];
    if (!links.length) return;
    const current = links.indexOf(event.target as HTMLAnchorElement);
    const index = current < 0 ? 0 : current;
    event.preventDefault();
    if (event.key === "Home") {
      links[0]?.focus();
      return;
    }
    if (event.key === "End") {
      links[links.length - 1]?.focus();
      return;
    }
    const delta = event.key === "ArrowRight" ? 1 : -1;
    links[(index + delta + links.length) % links.length]?.focus();
  }

  return (
    <nav
      ref={navRef}
      aria-label={`${model.name} workspace`}
      className="shrink-0 border-b border-[var(--erp-border)] bg-[var(--erp-surface)] px-3 py-1.5 md:px-5"
      onKeyDown={onKeyDown}
    >
      {items.length ? (
        <div className="flex flex-nowrap gap-1 overflow-x-auto overscroll-x-contain pb-0.5 md:flex-wrap md:overflow-visible">
          {items.map((item) => {
            const active = isWorkspaceNavItemActive(item, pathname, model);
            return (
              <Link
                key={item.id}
                to={item.path}
                data-workspace-nav={item.title}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-ring)] ${
                  active
                    ? "bg-[var(--erp-brand-soft)] font-semibold text-[var(--erp-brand)]"
                    : "font-medium text-[var(--erp-ink)] hover:bg-[var(--erp-bg)] active:bg-[var(--erp-bg)]"
                }`}
              >
                {item.title}
                {item.status === "placeholder" && !active ? (
                  <span className="ml-1.5 text-[10px] uppercase tracking-wide text-[var(--erp-muted)]">Soon</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="px-1 py-2 text-sm text-[var(--erp-muted)]">No matching features.</p>
      )}
    </nav>
  );
}
