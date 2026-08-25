import { Link } from "react-router-dom";
import { Badge, Card, EmptyState } from "@electronic-erp/ui";
import { APP_NAME } from "@/branding";

export function UnauthorizedPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Not authorized</h1>
        <Badge tone="warning">Restricted</Badge>
      </div>
      <Card title="This module is protected" description={`Your role does not include this area of ${APP_NAME}.`}>
        <EmptyState
          title="Access denied"
          description="Sign in with a role that has the required permission, or open another module from the sidebar."
          action={
            <Link
              to="/"
              className="inline-flex h-10 items-center justify-center rounded-[var(--erp-radius)] border border-[var(--erp-border)] bg-white px-4 text-sm font-medium text-[var(--erp-ink)] hover:bg-[var(--erp-bg)]"
            >
              Open Command Center
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
      <Card title="No matching route" description={`This URL is not registered in ${APP_NAME}.`}>
        <EmptyState
          title="Nothing here"
          description="Check the address or return to Command Center. Existing modules were not removed."
          action={
            <Link
              to="/"
              className="inline-flex h-10 items-center justify-center rounded-[var(--erp-radius)] border border-[var(--erp-border)] bg-white px-4 text-sm font-medium text-[var(--erp-ink)] hover:bg-[var(--erp-bg)]"
            >
              Open Command Center
            </Link>
          }
        />
      </Card>
    </div>
  );
}
