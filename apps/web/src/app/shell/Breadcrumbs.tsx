import { Breadcrumb } from "@electronic-erp/ui";

export function Breadcrumbs({
  moduleTitle,
  pageTitle,
}: {
  compact?: boolean;
  moduleTitle: string;
  pageTitle: string | null;
  modulePath?: string;
}) {
  const items = [
    { label: "Electronic ERP" },
    { label: moduleTitle },
    ...(pageTitle ? [{ label: pageTitle }] : []),
  ];

  return (
    <div className="min-w-0 flex-1">
      <div className="hidden md:block">
        <Breadcrumb items={items} />
      </div>
      <div className="truncate text-sm font-semibold text-[var(--erp-ink)]">
        {pageTitle ?? "Workspace"}
      </div>
    </div>
  );
}
