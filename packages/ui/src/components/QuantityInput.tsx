import { Button } from "./Button.js";
import { Input } from "./Input.js";

export function QuantityInput({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  error,
}: {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
  error?: string;
}) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <Input
          label={label}
          inputMode="decimal"
          error={error}
          value={String(value)}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n) || n < min) return;
            onChange(n);
          }}
        />
      </div>
      <Button
        type="button"
        variant="secondary"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(min, Math.round((value - step) * 10000) / 10000))}
      >
        −
      </Button>
      <Button
        type="button"
        variant="secondary"
        aria-label="Increase quantity"
        onClick={() => onChange(Math.round((value + step) * 10000) / 10000)}
      >
        +
      </Button>
    </div>
  );
}
