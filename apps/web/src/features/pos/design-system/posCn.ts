import { clsx, type ClassValue } from "clsx";

/** Local cn for POS design-system (mirrors @electronic-erp/ui). */
export function posCn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
