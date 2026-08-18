import type { ReactNode } from "react";
import { posCn } from "./posCn";

export type POSBadgeTone = "neutral" | "success" | "warning" | "danger" | "primary" | "secondary";

const tones: Record<POSBadgeTone, string> = {
  neutral: "bg-[var(--pos-muted-bg)] text-[var(--pos-muted)]",
  success: "bg-[var(--pos-success-soft)] text-[var(--pos-success)]",
  warning: "bg-[var(--pos-warning-soft)] text-[var(--pos-warning)]",
  danger: "bg-[var(--pos-danger-soft)] text-[var(--pos-danger)]",
  primary: "bg-[var(--pos-primary-soft)] text-[var(--pos-primary)]",
  secondary: "bg-[var(--pos-secondary-soft)] text-[var(--pos-secondary)]",
};

export function POSBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: POSBadgeTone;
  className?: string;
}) {
  return (
    <span
      className={posCn(
        "inline-flex items-center rounded-[var(--pos-radius-sm)] px-1.5 py-0.5 text-[length:var(--pos-text-xs)] font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
