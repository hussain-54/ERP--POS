import { mapSalesmanEmployees, type SalesmanOption } from "@/features/salesman/SalesmanPage";
import type { POSBadgeTone } from "./design-system";

export { mapSalesmanEmployees };
export type { SalesmanOption };

export const SALESMEN_TABLE_COLUMNS = [
  "Salesman",
  "Code",
  "Phone",
  "Commission",
  "Sales",
  "Status",
] as const;

export type SalesmanDirectoryRow = {
  id: string;
  userId: string | null;
  name: string;
  code: string;
  phone: string;
  commissionPercent: number;
  salesTotal: number | null;
  status: "active" | "inactive";
  selectableOnSale: boolean;
};

export function salesmanStatusTone(status: string): POSBadgeTone {
  return status === "active" ? "success" : "neutral";
}

export function salesTotalByUserId(reports: Record<string, unknown> | null): Map<string, number> {
  const map = new Map<string, number>();
  const rows = (reports?.salesmanSales as Array<Record<string, unknown>> | undefined) ?? [];
  for (const row of rows) {
    const id = String(row.salesmanUserId ?? row.salesman_user_id ?? "");
    if (!id) continue;
    map.set(id, Number(row.salesTotal ?? row.sales_total ?? 0) || 0);
  }
  return map;
}

export function parseSalesmanDirectory(
  items: Array<Record<string, unknown>>,
  salesByUser: Map<string, number>,
): SalesmanDirectoryRow[] {
  return items
    .filter((row) => Boolean(row.is_salesman))
    .map((row) => {
      const userId = row.user_id != null ? String(row.user_id) : null;
      const active = row.is_active !== false;
      return {
        id: String(row.id ?? ""),
        userId,
        name: String(row.full_name ?? row.name ?? "Salesman"),
        code: String(row.code ?? ""),
        phone: String(row.mobile ?? ""),
        commissionPercent: Number(row.commission_percent ?? 0) || 0,
        salesTotal: userId && salesByUser.has(userId) ? (salesByUser.get(userId) ?? 0) : null,
        status: active ? "active" : "inactive",
        selectableOnSale: Boolean(userId) && active,
      };
    });
}
