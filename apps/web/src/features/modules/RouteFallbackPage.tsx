import { Link } from "react-router-dom";
import { Badge, Card, EmptyState } from "@electronic-erp/ui";

export function UnauthorizedPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Not authorized</h1>
        <Badge>Restricted</Badge>
      </div>
      <Card title="This module is protected" description="Your role does not include this area.">
        <EmptyState
          title="Access denied"
          description="The screen is still registered. Sign in with a role that has the required permission, or open another module."
          action={
            <Link
              to="/"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--erp-border)] bg-white px-4 text-sm font-medium text-[var(--erp-ink)] hover:bg-[var(--erp-bg)]"
            >
              Open Dashboard
            </Link>
          }
        />
      </Card>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <Badge>404</Badge>
      </div>
      <Card title="No matching route" description="This URL is not registered in the ERP.">
        <EmptyState
          title="Nothing here"
          description="Check the address or return to the dashboard. Existing modules were not removed."
          action={
            <Link
              to="/"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--erp-border)] bg-white px-4 text-sm font-medium text-[var(--erp-ink)] hover:bg-[var(--erp-bg)]"
            >
              Open Dashboard
            </Link>
          }
        />
      </Card>
    </div>
  );
}
