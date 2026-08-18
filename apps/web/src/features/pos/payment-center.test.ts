import { describe, expect, it } from "vitest";
import {
  parsePaymentRow,
  paymentNumber,
  paymentStatusText,
  rowHasRecordOnlyMethod,
} from "./payment-center";

describe("payment center helpers", () => {
  it("uses receipt number as payment # and maps posted/synced to Recorded", () => {
    const row = parsePaymentRow({
      id: "p1",
      receiptNumber: "RCV-1",
      occurredAt: "2026-08-16T10:00:00.000Z",
      status: "posted",
      syncState: "synced",
      totalAmount: "150.00",
      customerName: "Ahmed",
      splits: [{ amount: 150, methodName: "Cash", methodKind: "cash" }],
    });
    expect(paymentNumber(row)).toBe("RCV-1");
    expect(paymentStatusText(row)).toBe("Recorded");
    expect(rowHasRecordOnlyMethod(row)).toBe(false);
  });

  it("flags wallet splits as record-only", () => {
    const row = parsePaymentRow({
      id: "p2",
      receiptNumber: "RCV-2",
      status: "posted",
      syncState: "synced",
      totalAmount: 200,
      splits: [{ amount: 200, methodName: "JazzCash", methodKind: "jazzcash" }],
    });
    expect(rowHasRecordOnlyMethod(row)).toBe(true);
  });

  it("maps stored backend states onto Recorded / Pending / Failed / Reversed", () => {
    expect(paymentStatusText(parsePaymentRow({ status: "posted", syncState: "pending" }))).toBe("Pending");
    expect(paymentStatusText(parsePaymentRow({ status: "draft", syncState: "synced" }))).toBe("Pending");
    expect(paymentStatusText(parsePaymentRow({ status: "posted", syncState: "conflict" }))).toBe("Failed");
    expect(paymentStatusText(parsePaymentRow({ status: "posted", syncState: "rejected" }))).toBe("Failed");
    expect(paymentStatusText(parsePaymentRow({ status: "void", syncState: "synced" }))).toBe("Reversed");
  });
});
