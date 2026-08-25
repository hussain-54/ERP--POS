/** Decorative barcode strip for list/detail when a real code exists. */
export function BarcodeStrip({ value, compact }: { value: string; compact?: boolean }) {
  const code = value.trim();
  if (!code) return null;

  const bars = code.split("").flatMap((ch, i) => {
    const n = ch.charCodeAt(0) + i;
    return [1, n % 2 === 0 ? 2 : 1, n % 3 === 0 ? 1 : 2, 1];
  });

  const height = compact ? 20 : 28;
  const barWidth = compact ? 1.2 : 1.5;

  return (
    <div className="inline-flex max-w-full flex-col items-start gap-0.5" title={code}>
      <svg
        role="img"
        aria-label={`Barcode ${code}`}
        height={height}
        className="max-w-[120px] text-[var(--erp-ink)]"
        viewBox={`0 0 ${bars.length * barWidth + 4} ${height}`}
        preserveAspectRatio="xMinYMid meet"
      >
        {bars.map((w, idx) => (
          <rect
            key={idx}
            x={2 + idx * barWidth}
            y={2}
            width={w * 0.45}
            height={height - 4}
            fill="currentColor"
            opacity={idx % 2 === 0 ? 1 : 0.85}
          />
        ))}
      </svg>
      <span className="max-w-[120px] truncate font-mono text-[10px] leading-none text-[var(--erp-muted)]">
        {code}
      </span>
    </div>
  );
}
