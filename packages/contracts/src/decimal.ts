import { z } from "zod";

/** Decimal string — avoids IEEE float damage for qty/money. */
export const DecimalStringSchema = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, "Invalid decimal value")
  .refine((v) => Number(v) >= 0, "Value cannot be negative");

export const PositiveDecimalStringSchema = DecimalStringSchema.refine(
  (v) => Number(v) > 0,
  "Value must be greater than zero",
);

export type DecimalString = z.infer<typeof DecimalStringSchema>;

const SCALE = 6n;
const FACTOR = 1_000_000n;

function toScaled(value: string): bigint {
  const normalized = value.trim();
  // Signed arithmetic for ledger deltas; storage schemas remain non-negative.
  if (!/^-?\d+(\.\d{1,6})?$/.test(normalized)) {
    throw new Error(`Invalid decimal: ${value}`);
  }
  const neg = normalized.startsWith("-");
  const abs = neg ? normalized.slice(1) : normalized;
  const [whole, frac = ""] = abs.split(".");
  const scaled = BigInt(whole + frac.padEnd(Number(SCALE), "0").slice(0, Number(SCALE)));
  return neg ? -scaled : scaled;
}

function fromScaled(value: bigint, outScale = 4): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const raw = abs.toString().padStart(Number(SCALE) + 1, "0");
  const whole = raw.slice(0, -Number(SCALE)) || "0";
  const frac = raw.slice(-Number(SCALE), -Number(SCALE) + outScale);
  const joined = frac.replace(/0+$/, "") ? `${whole}.${frac.replace(/0+$/, "")}` : whole;
  return `${neg ? "-" : ""}${joined}`;
}

export function multiplyDecimal(a: string, b: string, scale = 4): string {
  const product = (toScaled(a) * toScaled(b)) / FACTOR;
  return fromScaled(product, scale);
}

export function subtractDecimal(a: string, b: string, scale = 4): string {
  return fromScaled(toScaled(a) - toScaled(b), scale);
}

export function addDecimal(a: string, b: string, scale = 4): string {
  return fromScaled(toScaled(a) + toScaled(b), scale);
}

export function compareDecimal(a: string, b: string): number {
  const d = toScaled(a) - toScaled(b);
  if (d < 0n) return -1;
  if (d > 0n) return 1;
  return 0;
}
