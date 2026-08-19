export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 rounded-[var(--erp-radius)] border border-[var(--erp-border)] bg-[var(--erp-surface)] px-4 py-8 text-sm text-[var(--erp-muted)]"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--erp-brand)] border-r-transparent" />
      {label}
    </div>
  );
}
