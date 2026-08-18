import { Link } from "react-router-dom";
import { posCn } from "./posCn";

export function POSBreadcrumb({
  items,
  className,
}: {
  items: Array<{ label: string; to?: string }>;
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={posCn("text-xs text-[var(--pos-muted)]", className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <span aria-hidden>›</span> : null}
              {item.to && !last ? (
                <Link to={item.to} className="hover:text-[var(--pos-ink)]">
                  {item.label}
                </Link>
              ) : (
                <span
                  className={last ? "font-medium text-[var(--pos-ink)]" : undefined}
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
