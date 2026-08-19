import { Link } from "react-router-dom";
import { systemAdminNavGroups } from "./system-admin-nav";

export function SystemAdminHome() {
  const groups = systemAdminNavGroups();

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-[var(--erp-muted)]">
        Organization and operations. Live sections open existing screens. Other sections
        are Coming Soon — no sample settings or placeholder APIs.
      </p>

      {groups.map((group) => (
        <section key={group.title}>
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--erp-muted)]">
            {group.title}
          </h2>
          <ul className="divide-y divide-[var(--erp-border)] rounded-[var(--erp-radius)] border border-[var(--erp-border)]">
            {group.items.map((item) => {
              const live = item.status === "implemented";
              return (
                <li key={`${item.path}:${item.title}`}>
                  <Link
                    to={item.path}
                    className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-[var(--erp-brand-soft)]"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--erp-ink)]">{item.title}</span>
                      <span className="block truncate text-xs text-[var(--erp-muted)]">{item.description}</span>
                    </span>
                    <span
                      className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${
                        live ? "text-[var(--erp-brand)]" : "text-[var(--erp-muted)]"
                      }`}
                    >
                      {live ? "Live" : "Soon"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
