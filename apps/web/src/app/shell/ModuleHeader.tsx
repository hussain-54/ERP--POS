import type { ReactNode } from "react";
import { SearchInput } from "@electronic-erp/ui";
import { NavIcon } from "@/app/shell/nav-icons";
import type { ModuleWorkspaceModel } from "@/app/shell/module-workspace";

export function ModuleHeader({
  model,
  query,
  onQueryChange,
  actions,
}: {
  model: ModuleWorkspaceModel;
  query: string;
  onQueryChange: (value: string) => void;
  actions?: ReactNode;
}) {
  return (
    <header className="flex shrink-0 flex-col gap-3 border-b border-[var(--erp-border)] bg-[var(--erp-surface)] px-3 py-3 md:px-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--erp-brand-soft)] text-[var(--erp-brand)] [&_svg]:h-5 [&_svg]:w-5">
          <NavIcon name={model.icon} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-[var(--erp-muted)]">{model.number}</p>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--erp-ink)] md:text-xl">{model.name}</h1>
          <p className="mt-1 hidden max-w-3xl text-sm leading-relaxed text-[var(--erp-muted)] md:block">
            {model.description}
          </p>
        </div>
        {actions ? <div className="hidden flex-wrap items-center gap-2 md:flex">{actions}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 md:hidden">{actions}</div> : null}
      <div className="w-full max-w-md">
        <SearchInput
          aria-label={`Search ${model.name}`}
          placeholder={model.searchPlaceholder}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="h-11 min-h-11"
        />
      </div>
    </header>
  );
}
