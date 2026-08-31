import { Link } from "react-router-dom";
import { Badge, Breadcrumb, Card, EmptyState, PageHeader } from "@electronic-erp/ui";
import type { ErpModuleRoute } from "@/app/modules";

export function ModulePlaceholderPage({ module }: { module: ErpModuleRoute }) {
  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Home", href: "/command-center" },
          { label: module.group || "Operations", href: "/command-center" },
          { label: module.title },
        ]}
      />

      <PageHeader
        title={module.title}
        eyebrow={module.group}
        description={module.description}
        badge={<Badge tone="neutral">Coming soon</Badge>}
        actions={
          module.availableOn ? (
            <Link
              to={module.availableOn}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
            >
              <span>Open Operational Counterpart →</span>
            </Link>
          ) : undefined
        }
      />

      <Card title="Module not yet implemented" description="Part of the 39-module master ERP system." divided>
        <EmptyState
          icon={<i className="fa-solid fa-layer-group text-2xl text-blue-600" />}
          title="Coming soon"
          description={`This module is reserved in the 39-module ERP structure. Existing business functions were not changed, and no sample data is shown here.`}
          action={
            module.availableOn ? (
              <Link
                to={module.availableOn}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs hover:border-blue-300 hover:text-blue-700 transition"
              >
                <i className="fa-solid fa-arrow-right text-[11px]" />
                <span>Open related screen</span>
              </Link>
            ) : undefined
          }
        />
      </Card>
    </div>
  );
}
