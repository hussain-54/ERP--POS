import { addDecimal, multiplyDecimal, type CostingMethod } from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";

export interface CostLayer {
  id: string;
  qtyRemaining: string;
  unitCost: string;
  receivedAt: string;
}

export interface ValuationContext {
  method: CostingMethod;
  averageUnitCost: string;
  layers: CostLayer[];
  standardUnitCost?: string;
}

/** Pluggable costing — do not hardcode a single methodology. */
export function resolveIssueUnitCost(
  ctx: ValuationContext,
  _qty: string,
  specificUnitCost?: string,
): { unitCost: string; method: CostingMethod } {
  switch (ctx.method) {
    case "moving_average":
      return { unitCost: ctx.averageUnitCost || "0", method: ctx.method };
    case "standard":
      return { unitCost: ctx.standardUnitCost ?? ctx.averageUnitCost ?? "0", method: ctx.method };
    case "specific":
      if (specificUnitCost == null) {
        throw new ValidationDomainError("Specific costing requires unit cost");
      }
      return { unitCost: specificUnitCost, method: ctx.method };
    case "fifo":
      return { unitCost: pickLayerCost(ctx.layers, "fifo"), method: ctx.method };
    case "lifo":
      return { unitCost: pickLayerCost(ctx.layers, "lifo"), method: ctx.method };
    default: {
      const _exhaustive: never = ctx.method;
      throw new ValidationDomainError(`Unknown costing method: ${_exhaustive}`);
    }
  }
}

function pickLayerCost(layers: CostLayer[], mode: "fifo" | "lifo"): string {
  if (!layers.length) return "0";
  const sorted = [...layers].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  const layer = mode === "fifo" ? sorted[0] : sorted[sorted.length - 1];
  return layer?.unitCost ?? "0";
}

/** Moving-average update after inbound receipt. */
export function updateMovingAverageCost(
  currentQty: string,
  currentAvg: string,
  inboundQty: string,
  inboundUnitCost: string,
): string {
  const currentValue = multiplyDecimal(currentQty, currentAvg);
  const inboundValue = multiplyDecimal(inboundQty, inboundUnitCost);
  const totalQty = addDecimal(currentQty, inboundQty);
  if (Number(totalQty) <= 0) return inboundUnitCost;
  // value / qty with 4dp via multiply by reciprocal
  const totalValue = addDecimal(currentValue, inboundValue);
  const factor = (Number(totalValue) / Number(totalQty)).toFixed(4);
  return factor.replace(/\.?0+$/, "") === "" ? "0" : factor.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}
