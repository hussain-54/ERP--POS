import { Badge, Card, EmptyState } from "@electronic-erp/ui";
import type { ErpModuleRoute } from "@/app/modules";

export function ModulePlaceholderPage({ module }: { module: ErpModuleRoute }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{module.title}</h1>
        <Badge tone="brand">{module.group}</Badge>
        <Badge>Foundation placeholder</Badge>
      </div>
      <Card title="Module ready for Phase implementation" description={module.description}>
        <EmptyState
          title="Business functionality not implemented yet"
          description="This route is part of the Phase 1 application shell. Domain features will be added in later phases without changing the architecture."
        />
      </Card>
    </div>
  );
}
