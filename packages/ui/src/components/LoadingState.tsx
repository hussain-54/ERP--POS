export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl border border-[var(--erp-border)] bg-white px-6 py-12 text-sm text-[var(--erp-muted)]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--erp-brand)] border-r-transparent" />
      {label}
    </div>
  );
}
