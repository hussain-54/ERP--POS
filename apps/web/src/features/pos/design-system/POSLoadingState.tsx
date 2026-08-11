import { posCn } from "./posCn";

export function POSLoadingState({
  label = "Loading…",
  rows = 4,
  className,
}: {
  label?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={posCn("space-y-2 p-4", className)} role="status" aria-live="polite" aria-label={label}>
      <p className="sr-only">{label}</p>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="pos-skeleton h-8 w-full" />
      ))}
    </div>
  );
}
