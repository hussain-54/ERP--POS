import type { ReactNode } from "react";
import { POSButton } from "./POSButton";
import { posCn } from "./posCn";

export function POSEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={posCn(
        "flex flex-col items-center justify-center gap-2 px-4 py-6 text-center",
        className,
      )}
      role="status"
    >
      {icon ? <div className="text-2xl text-[var(--pos-muted)]" aria-hidden>{icon}</div> : null}
      <p className="text-sm font-semibold text-[var(--pos-ink)]">{title}</p>
      {description ? <p className="max-w-sm text-xs text-[var(--pos-muted)]">{description}</p> : null}
      {actionLabel && onAction ? (
        <POSButton size="sm" variant="secondary" onClick={onAction} className="mt-2">
          {actionLabel}
        </POSButton>
      ) : null}
    </div>
  );
}
