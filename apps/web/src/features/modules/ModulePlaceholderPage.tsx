import { Link } from "react-router-dom";
import { Badge, Card, EmptyState } from "@electronic-erp/ui";
import type { ErpModuleRoute } from "@/app/modules";

export function ModulePlaceholderPage({ module }: { module: ErpModuleRoute }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">{module.title}</h2>
        <Badge tone="brand">{module.group}</Badge>
        <Badge>Coming soon</Badge>
      </div>
      <Card title="Module not yet implemented" description={module.description}>
        <EmptyState
          title="Coming soon"
          description="This module is reserved in the 39-module ERP structure. Existing business functions were not changed, and no sample data is shown here."
          action={
            module.availableOn ? (
              <Link
                to={module.availableOn}
                className="inline-flex h-10 items-center justify-center rounded-[var(--erp-radius)] border border-[var(--erp-border)] bg-white px-4 text-sm font-medium text-[var(--erp-ink)] hover:bg-[var(--erp-bg)]"
              >
                Open related screen
              </Link>
            ) : undefined
          }
        />
      </Card>
    </div>
  );
}
