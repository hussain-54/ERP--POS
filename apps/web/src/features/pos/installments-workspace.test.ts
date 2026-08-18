import { describe, expect, it } from "vitest";
import { installmentPlanProgress } from "@electronic-erp/domain";
import {
  INSTALLMENT_LINE_COLUMNS,
  INSTALLMENT_PLAN_COLUMNS,
  parseInstallmentPlanRow,
  planDisplayNumber,
  previewInstallmentSchedule,
} from "./installments-workspace";

describe("installment workspace", () => {
  it("locks plan and detail columns and uses domain progress", () => {
    expect([...INSTALLMENT_PLAN_COLUMNS]).toEqual([
      "Plan #",
      "Customer",
      "Invoice",
      "Total Amount",
      "Paid",
      "Remaining",
      "Next Due Date",
      "Status",
    ]);
    expect([...INSTALLMENT_LINE_COLUMNS]).toEqual([
      "Installment #",
      "Due Date",
      "Amount",
      "Paid",
      "Remaining",
      "Status",
    ]);
    const row = parseInstallmentPlanRow(
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        customerName: "Ahmed",
        invoiceNumber: "INV-9",
        total_amount: "1000",
        down_payment: "200",
        status: "active",
        schedule: [
          { sequence_no: 1, due_date: "2026-01-01", amount: "400", paid_amount: "400", status: "paid" },
          { sequence_no: 2, due_date: "2026-02-01", amount: "400", paid_amount: "0", status: "pending" },
        ],
      },
      "2026-01-15",
    );
    expect(row.planNumber).toBe(planDisplayNumber(row.id));
    expect(row.paid).toBe(Number(installmentPlanProgress({
      totalAmount: "1000",
      downPayment: "200",
      planStatus: "active",
      asOfDate: "2026-01-15",
      schedule: [
        { sequenceNo: 1, dueDate: "2026-01-01", amount: "400", paidAmount: "400", status: "paid" },
        { sequenceNo: 2, dueDate: "2026-02-01", amount: "400", paidAmount: "0", status: "pending" },
      ],
    }).paid));
    expect(previewInstallmentSchedule({
      totalAmount: "1000",
      downPayment: "200",
      installmentCount: 2,
      startDate: "2026-01-01",
    }).schedule).toHaveLength(2);
  });
});
