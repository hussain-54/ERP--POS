import type { ReactNode } from "react";
import { POSCard } from "./POSCard";
import { posCn } from "./posCn";

export function POSStatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "primary";
  icon?: ReactNode;
  className?: string;
}) {
  const valueTone = {
    neutral: "text-[var(--pos-ink)]",
    success: "text-[var(--pos-success)]",
    warning: "text-[var(--pos-warning)]",
    danger: "text-[var(--pos-danger)]",
    primary: "text-[var(--pos-primary)]",
  }[tone];

  return (
    <POSCard padding="sm" className={posCn("min-w-[7.5rem]", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--pos-muted)]">
          {label}
        </p>
        {icon ? <span className="text-[var(--pos-muted)]">{icon}</span> : null}
      </div>
      <p className={posCn("mt-0.5 text-[length:var(--pos-text-xl)] font-semibold tabular-nums", valueTone)}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-[var(--pos-muted)]">{hint}</p> : null}
    </POSCard>
  );
}
