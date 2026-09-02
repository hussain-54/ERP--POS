import type { SaleListRow } from "@electronic-erp/contracts";
import { money } from "../format";

export type ShiftView = {
  id: string;
  status: string;
  openingFloat: number;
  expectedCash: number;
  salesTotal: number;
  cashSalesTotal: number;
  expenseTotal: number;
  closingCounted: number | null;
  variance: number | null;
  openedAt: string | null;
  closedAt: string | null;
  openedBy: string | null;
  notes: string | null;
};

export type ShiftWorkspaceMode =
  | "dashboard"
  | "open"
  | "opening-cash"
  | "cash-in"
  | "cash-out"
  | "drawer"
  | "transfer"
  | "expenses"
  | "close"
  | "reconcile";

export interface ShiftPaymentBreakdown {
  openingCash: number;
  cashSales: number;
  cardSales: number;
  walletSales: number;
  otherSales: number;
  totalSales: number;
  cashIn: number;
  cashOut: number;
  expenses: number;
  expectedCash: number;
  actualCash?: number;
  difference?: number;
}

export interface ShiftClosingSummaryData {
  shiftId: string;
  branchName: string;
  cashierName: string;
  terminalId: string;
  openedAt: string;
  closedAt: string;
  duration: string;
  openingCash: number;
  cashSales: number;
  cardSales: number;
  walletSales: number;
  totalSales: number;
  cashIn: number;
  cashOut: number;
  expenses: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  notes?: string;
  movementsCount: number;
  salesCount: number;
}

export function mapShiftRow(row: Record<string, unknown> | null): ShiftView | null {
  if (!row) return null;
  return {
    id: String(row.id),
    status: String(row.status ?? "open"),
    openingFloat: Number(row.opening_float ?? 0),
    expectedCash: Number(row.expected_cash ?? 0),
    salesTotal: Number(row.sales_total ?? 0),
    cashSalesTotal: Number(row.cash_sales_total ?? 0),
    expenseTotal: Number(row.expense_total ?? 0),
    closingCounted: row.closing_counted != null ? Number(row.closing_counted) : null,
    variance: row.variance != null ? Number(row.variance) : null,
    openedAt: row.opened_at ? String(row.opened_at) : null,
    closedAt: row.closed_at ? String(row.closed_at) : null,
    openedBy: row.opened_by ? String(row.opened_by) : null,
    notes: row.notes ? String(row.notes) : null,
  };
}

export function sumCashMovements(items: Array<Record<string, unknown>>) {
  let cashIn = 0;
  let cashOut = 0;
  let expenses = 0;
  for (const row of items) {
    const amount = Number(row.amount ?? 0);
    const kind = String(row.kind ?? "");
    const reason = String(row.reason ?? "").toLowerCase();
    if (kind === "cash_in") {
      cashIn += amount;
    } else if (kind === "cash_out") {
      cashOut += amount;
      if (reason.includes("expense") || reason.includes("petty") || reason.includes("bill") || reason.includes("tea") || reason.includes("maintenance")) {
        expenses += amount;
      }
    }
  }
  return { cashIn, cashOut, expenses };
}

export function computeShiftBreakdown(
  shift: ShiftView | null,
  sales: SaleListRow[],
  movements: Array<Record<string, unknown>>,
): ShiftPaymentBreakdown {
  if (!shift) {
    return {
      openingCash: 0,
      cashSales: 0,
      cardSales: 0,
      walletSales: 0,
      otherSales: 0,
      totalSales: 0,
      cashIn: 0,
      cashOut: 0,
      expenses: 0,
      expectedCash: 0,
    };
  }

  let cardSales = 0;
  let walletSales = 0;
  let cashSalesFromList = 0;
  let otherSales = 0;

  for (const sale of sales) {
    const methodStr = (sale.paymentMethods || "").toLowerCase();
    const grand = Number(sale.paidTotal || sale.grandTotal || 0);

    if (methodStr.includes("card") || methodStr.includes("visa") || methodStr.includes("mastercard")) {
      cardSales += grand;
    } else if (
      methodStr.includes("wallet") ||
      methodStr.includes("jazzcash") ||
      methodStr.includes("easypaisa") ||
      methodStr.includes("sadapay") ||
      methodStr.includes("nayapay") ||
      methodStr.includes("raast") ||
      methodStr.includes("qr")
    ) {
      walletSales += grand;
    } else if (methodStr.includes("bank") || methodStr.includes("credit") || methodStr.includes("udhaar")) {
      otherSales += grand;
    } else {
      cashSalesFromList += grand;
    }
  }

  const { cashIn, cashOut, expenses } = sumCashMovements(movements);

  // If cashSalesFromList is 0 but shift has cashSalesTotal recorded, use shift's numbers
  const cashSales = cashSalesFromList > 0 ? cashSalesFromList : shift.cashSalesTotal;
  const nonCashTotal = Math.max(0, shift.salesTotal - cashSales);
  
  if (cardSales === 0 && walletSales === 0 && nonCashTotal > 0) {
    cardSales = nonCashTotal;
  }

  const openingCash = shift.openingFloat;
  const expectedCash = openingCash + cashSales + cashIn - cashOut;

  return {
    openingCash,
    cashSales,
    cardSales,
    walletSales,
    otherSales,
    totalSales: shift.salesTotal || cashSales + cardSales + walletSales + otherSales,
    cashIn,
    cashOut,
    expenses: expenses > 0 ? expenses : shift.expenseTotal || 0,
    expectedCash: shift.expectedCash || expectedCash,
  };
}

export function otherPaymentsTotal(shift: ShiftView): number {
  return Math.max(0, shift.salesTotal - shift.cashSalesTotal);
}

export function shiftDifference(actual: number, expected: number): number {
  return Math.round((actual - expected) * 100) / 100;
}

export function formatShiftDuration(openedAt: string | null, closedAt?: string | null): string {
  if (!openedAt) return "—";
  const start = new Date(openedAt).getTime();
  const end = closedAt ? new Date(closedAt).getTime() : Date.now();
  const ms = Math.max(0, end - start);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export function reconciliationLines(
  _shift: ShiftView,
  breakdown: ShiftPaymentBreakdown,
) {
  return [
    { label: "Opening Cash (Float)", value: breakdown.openingCash },
    { label: "Cash Sales (+)", value: breakdown.cashSales },
    { label: "Card Sales (Non-Drawer)", value: breakdown.cardSales },
    { label: "Wallet Sales (Non-Drawer)", value: breakdown.walletSales },
    { label: "Cash In (+)", value: breakdown.cashIn },
    { label: "Cash Out / Drops (−)", value: breakdown.cashOut },
    { label: "Expenses (−)", value: breakdown.expenses },
    { label: "Expected Cash in Drawer", value: breakdown.expectedCash, emphasis: true },
  ];
}

/**
 * Print thermal 80mm Shift Closing Summary
 */
export function printShiftSummaryReport(data: ShiftClosingSummaryData) {
  if (typeof window === "undefined") return;

  const win = window.open("", "ShiftSummaryPrint", "width=400,height=600");
  if (!win) return;

  const varianceSign = data.difference >= 0 ? "+" : "−";
  const varianceClass = data.difference === 0 ? "exact" : data.difference > 0 ? "surplus" : "shortage";

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Shift Closing Summary - #${data.shiftId.slice(0, 8)}</title>
        <style>
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            margin: 0;
            padding: 12px;
            color: #000;
          }
          .header { text-align: center; margin-bottom: 12px; }
          .title { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
          .subtitle { font-size: 11px; margin-bottom: 6px; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .double-divider { border-top: 2px solid #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .bold { font-weight: bold; }
          .highlight { font-size: 13px; font-weight: bold; }
          .footer { text-align: center; font-size: 10px; margin-top: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">SHIFT CLOSING SUMMARY</div>
          <div class="subtitle">${data.branchName}</div>
          <div>${new Date().toLocaleString()}</div>
        </div>
        <div class="divider"></div>
        <div class="row"><span>Shift ID:</span><span class="bold">#${data.shiftId.slice(0, 8)}</span></div>
        <div class="row"><span>Cashier:</span><span>${data.cashierName}</span></div>
        <div class="row"><span>Terminal:</span><span>${data.terminalId}</span></div>
        <div class="row"><span>Opened:</span><span>${new Date(data.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
        <div class="row"><span>Closed:</span><span>${new Date(data.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
        <div class="row"><span>Duration:</span><span>${data.duration}</span></div>
        <div class="divider"></div>
        <div class="bold">FINANCIAL BREAKDOWN:</div>
        <div class="row"><span>Opening Float:</span><span>Rs. ${money(data.openingCash)}</span></div>
        <div class="row"><span>Cash Sales:</span><span>Rs. ${money(data.cashSales)}</span></div>
        <div class="row"><span>Card Sales:</span><span>Rs. ${money(data.cardSales)}</span></div>
        <div class="row"><span>Wallet Sales:</span><span>Rs. ${money(data.walletSales)}</span></div>
        <div class="row bold"><span>Total Sales (${data.salesCount} txns):</span><span>Rs. ${money(data.totalSales)}</span></div>
        <div class="divider"></div>
        <div class="row"><span>Cash In:</span><span>+Rs. ${money(data.cashIn)}</span></div>
        <div class="row"><span>Cash Out:</span><span>-Rs. ${money(data.cashOut)}</span></div>
        <div class="row"><span>Expenses:</span><span>-Rs. ${money(data.expenses)}</span></div>
        <div class="double-divider"></div>
        <div class="row highlight"><span>EXPECTED CASH:</span><span>Rs. ${money(data.expectedCash)}</span></div>
        <div class="row highlight"><span>ACTUAL COUNTED:</span><span>Rs. ${money(data.actualCash)}</span></div>
        <div class="row highlight">
          <span>VARIANCE:</span>
          <span>${varianceSign}Rs. ${money(Math.abs(data.difference))} (${varianceClass.toUpperCase()})</span>
        </div>
        <div class="double-divider"></div>
        ${data.notes ? `<div class="row"><span>Notes:</span><span>${data.notes}</span></div>` : ""}
        <div class="footer">
          <div>Cashier Signature: __________________</div>
          <br/>
          <div>Manager Signature: __________________</div>
          <br/>
          <div>Electronic ERP · Shift Audit Completed</div>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `);
  win.document.close();
}
