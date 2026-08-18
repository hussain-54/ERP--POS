import { posCn } from "./posCn";

export interface POSStepperStep {
  id: string;
  label: string;
}

export function POSStepper({
  steps,
  activeId,
  className,
}: {
  steps: POSStepperStep[];
  activeId: string;
  className?: string;
}) {
  const activeIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === activeId),
  );

  return (
    <ol
      className={posCn("flex flex-wrap items-center gap-2", className)}
      aria-label="Progress"
    >
      {steps.map((step, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              className={posCn(
                "inline-flex h-6 min-w-6 items-center justify-center rounded-[var(--pos-radius-sm)] px-1.5 text-[11px] font-bold",
                done && "bg-[var(--pos-success)] text-white",
                active && "bg-[var(--pos-primary)] text-white",
                !done && !active && "bg-[var(--pos-muted-bg)] text-[var(--pos-muted)]",
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? "✓" : index + 1}
            </span>
            <span
              className={posCn(
                "text-xs font-medium",
                active ? "text-[var(--pos-ink)]" : "text-[var(--pos-muted)]",
              )}
            >
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <span className="mx-1 hidden h-px w-6 bg-[var(--pos-border)] sm:inline-block" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
