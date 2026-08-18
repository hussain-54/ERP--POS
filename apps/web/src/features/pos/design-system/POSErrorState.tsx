import { POSButton } from "./POSButton";
import { posCn } from "./posCn";

export function POSErrorState({
  title,
  description,
  actionLabel = "Retry",
  onAction,
  className,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div
      className={posCn(
        "flex flex-col items-center justify-center gap-2 px-4 py-6 text-center",
        className,
      )}
      role="alert"
    >
      <p className="text-sm font-semibold text-[var(--pos-danger)]">{title}</p>
      {description ? <p className="max-w-sm text-xs text-[var(--pos-muted)]">{description}</p> : null}
      {onAction ? (
        <POSButton size="sm" variant="secondary" onClick={onAction} className="mt-2">
          {actionLabel}
        </POSButton>
      ) : null}
    </div>
  );
}
