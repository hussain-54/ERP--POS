import { describe, expect, it } from "vitest";
import { parseSalesmanDirectory, salesTotalByUserId, SALESMEN_TABLE_COLUMNS } from "./salesman-workspace";

describe("salesman workspace", () => {
  it("locks directory columns and maps HR salesman profiles without inventing sales totals", () => {
    expect([...SALESMEN_TABLE_COLUMNS]).toEqual([
      "Salesman",
      "Code",
      "Phone",
      "Commission",
      "Sales",
      "Status",
    ]);
    const rows = parseSalesmanDirectory(
      [
        {
          id: "e1",
          is_salesman: true,
          full_name: "Ali",
          code: "SM-1",
          mobile: "0300",
          commission_percent: 2,
          user_id: "u1",
          is_active: true,
        },
        {
          id: "e2",
          is_salesman: true,
          full_name: "Inactive",
          code: "SM-2",
          user_id: null,
          is_active: false,
        },
        { id: "e3", is_salesman: false, full_name: "Storekeeper" },
      ],
      salesTotalByUserId({ salesmanSales: [{ salesmanUserId: "u1", salesTotal: 1500 }] }),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: "Ali",
      code: "SM-1",
      phone: "0300",
      commissionPercent: 2,
      salesTotal: 1500,
      selectableOnSale: true,
    });
    expect(rows[1]?.selectableOnSale).toBe(false);
    expect(rows[1]?.salesTotal).toBeNull();
  });
});
