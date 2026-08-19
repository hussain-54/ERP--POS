import { Link } from "react-router-dom";
import { EmptyState } from "@electronic-erp/ui";
import type { ErpModuleRoute } from "@/app/modules";

export function SystemComingSoonPage({ module }: { module: ErpModuleRoute }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[var(--erp-ink)]">{module.title}</h2>
        <p className="mt-1 text-sm text-[var(--erp-muted)]">{module.description}</p>
      </div>
      <EmptyState
        title="Coming Soon"
        description="This System Administration section is not implemented yet. Existing live settings were not changed, and no sample forms or APIs are shown here."
        action={
          module.availableOn ? (
            <Link
              to={module.availableOn}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--erp-border)] bg-white px-4 text-sm font-medium text-[var(--erp-ink)] hover:bg-[var(--erp-bg)]"
            >
              Open related screen
            </Link>
          ) : undefined
        }
      />
    </div>
  );
}
