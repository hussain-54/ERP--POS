import { describe, expect, it } from "vitest";
import {
  adjustCommissionForReturn,
  applyCommissionPayment,
  buildCommissionAccrual,
  calculateSalesCommission,
  commissionDue,
  summarizeCommissionReports,
  voidCommissionForCancelledSale,
} from "./pos-commission.js";
import { ValidationDomainError } from "./errors.js";

const salesman = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const saleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("pos-commission", () => {
  it("sale: accrues commission on finalized posted sales only", () => {
    const accrual = buildCommissionAccrual({
      saleStatus: "posted",
      saleGrandTotal: 1000,
      commissionPercent: 5,
      salesmanUserId: salesman,
      saleId,
    });
    expect(accrual?.shouldAccrue).toBe(true);
    expect(accrual?.row).toMatchObject({
      baseAmount: 1000,
      commissionPercent: 5,
      commissionAmount: 50,
      status: "accrued",
      paidAmount: 0,
      originalAmount: 50,
    });
    expect(accrual?.row.commissionAmount).toBe(
      calculateSalesCommission(1000, 5).commissionAmount,
    );
  });

  it("sale: rejects accrual for non-posted sales", () => {
    expect(() =>
      buildCommissionAccrual({
        saleStatus: "draft",
        saleGrandTotal: 1000,
        commissionPercent: 5,
        salesmanUserId: salesman,
        saleId,
      }),
    ).toThrow(ValidationDomainError);
  });

  it("sale: skips accrual without salesman or rate", () => {
    expect(
      buildCommissionAccrual({
        saleStatus: "posted",
        saleGrandTotal: 1000,
        commissionPercent: 0,
        salesmanUserId: salesman,
        saleId,
      }),
    ).toBeNull();
    expect(
      buildCommissionAccrual({
        saleStatus: "posted",
        saleGrandTotal: 1000,
        commissionPercent: 5,
        salesmanUserId: null,
        saleId,
      }),
    ).toBeNull();
  });

  it("partial payment: updates status and due", () => {
    const accrued = buildCommissionAccrual({
      saleStatus: "posted",
      saleGrandTotal: 1000,
      commissionPercent: 5,
      salesmanUserId: salesman,
      saleId,
    })!.row;

    const partial = applyCommissionPayment({ commission: accrued, payAmount: 20 });
    expect(partial.status).toBe("partially_paid");
    expect(partial.paidAmount).toBe(20);
    expect(commissionDue(partial)).toBe(30);

    const full = applyCommissionPayment({ commission: partial, payAmount: 30 });
    expect(full.status).toBe("paid");
    expect(commissionDue(full)).toBe(0);
  });

  it("commission payment: rejects overpay and void pay", () => {
    const accrued = buildCommissionAccrual({
      saleStatus: "posted",
      saleGrandTotal: 1000,
      commissionPercent: 5,
      salesmanUserId: salesman,
      saleId,
    })!.row;
    expect(() => applyCommissionPayment({ commission: accrued, payAmount: 51 })).toThrow(
      ValidationDomainError,
    );
    const voided = voidCommissionForCancelledSale(accrued);
    expect(() => applyCommissionPayment({ commission: voided, payAmount: 1 })).toThrow(
      ValidationDomainError,
    );
  });

  it("return: reduces unpaid commission on returned amounts", () => {
    const accrued = buildCommissionAccrual({
      saleStatus: "posted",
      saleGrandTotal: 1000,
      commissionPercent: 5,
      salesmanUserId: salesman,
      saleId,
    })!.row;

    const afterPartialReturn = adjustCommissionForReturn({
      commission: accrued,
      returnedAmount: 200,
    });
    expect(afterPartialReturn.status).toBe("adjusted");
    expect(afterPartialReturn.baseAmount).toBe(800);
    expect(afterPartialReturn.commissionAmount).toBe(40);
    expect(afterPartialReturn.originalAmount).toBe(50);

    const afterFull = adjustCommissionForReturn({
      commission: afterPartialReturn,
      returnedAmount: 800,
    });
    expect(afterFull.status).toBe("void");
    expect(afterFull.commissionAmount).toBe(0);
  });

  it("return: does not claw back already-paid commission", () => {
    const accrued = buildCommissionAccrual({
      saleStatus: "posted",
      saleGrandTotal: 1000,
      commissionPercent: 5,
      salesmanUserId: salesman,
      saleId,
    })!.row;
    const paid = applyCommissionPayment({ commission: accrued, payAmount: 50 });
    const afterReturn = adjustCommissionForReturn({
      commission: paid,
      returnedAmount: 500,
    });
    expect(afterReturn.paidAmount).toBe(50);
    expect(afterReturn.status).toBe("paid");
    expect(afterReturn.commissionAmount).toBe(50);
  });

  it("cancel: voids unpaid commission for cancelled sale", () => {
    const accrued = buildCommissionAccrual({
      saleStatus: "posted",
      saleGrandTotal: 1000,
      commissionPercent: 5,
      salesmanUserId: salesman,
      saleId,
    })!.row;
    const voided = voidCommissionForCancelledSale(accrued);
    expect(voided.status).toBe("void");
    expect(voided.commissionAmount).toBe(0);
    expect(commissionDue(voided)).toBe(0);
  });

  it("cancel: keeps paid commission status when sale cancelled", () => {
    const accrued = buildCommissionAccrual({
      saleStatus: "posted",
      saleGrandTotal: 1000,
      commissionPercent: 5,
      salesmanUserId: salesman,
      saleId,
    })!.row;
    const partial = applyCommissionPayment({ commission: accrued, payAmount: 20 });
    const afterCancel = voidCommissionForCancelledSale(partial);
    expect(afterCancel.status).toBe("partially_paid");
    expect(afterCancel.paidAmount).toBe(20);
    expect(afterCancel.commissionAmount).toBe(50);
  });

  it("reports: salesman / reference / due / paid / top salesman", () => {
    const summary = summarizeCommissionReports([
      {
        salesmanUserId: salesman,
        salesmanName: "Ali",
        referenceId: "ref-1",
        referenceName: "Dealer A",
        saleGrandTotal: 1000,
        commissionAmount: 50,
        paidAmount: 20,
        status: "partially_paid",
      },
      {
        salesmanUserId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        salesmanName: "Bilal",
        saleGrandTotal: 500,
        commissionAmount: 10,
        paidAmount: 10,
        status: "paid",
      },
      {
        salesmanUserId: salesman,
        saleGrandTotal: 200,
        commissionAmount: 0,
        paidAmount: 0,
        status: "void",
      },
    ]);
    expect(summary.commissionDue).toBe(30);
    expect(summary.commissionPaid).toBe(30);
    expect(summary.salesmanSales[0]?.salesmanUserId).toBe(salesman);
    expect(summary.salesmanSales[0]?.salesTotal).toBe(1000);
    expect(summary.referenceSales[0]).toMatchObject({
      referenceId: "ref-1",
      salesTotal: 1000,
      count: 1,
    });
    expect(summary.topSalesman[0]?.salesmanUserId).toBe(salesman);
    expect(summary.topSalesman[0]?.commissionAmount).toBe(50);
  });
});
