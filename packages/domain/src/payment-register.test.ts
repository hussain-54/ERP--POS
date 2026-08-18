import { describe, expect, it } from "vitest";
import {
  isRecordOnlyPaymentKind,
  matchesPaymentRegister,
  paymentDisplayLabel,
  paymentDisplayStatus,
  summarizePaymentRegister,
} from "./payment-register.js";

describe("payment register display", () => {
  it("maps stored status and sync_state onto Recorded / Pending / Failed / Reversed", () => {
    expect(paymentDisplayStatus({ status: "posted", syncState: "synced" })).toBe("recorded");
    expect(paymentDisplayLabel({ status: "posted", syncState: "synced" })).toBe("Recorded");
    expect(paymentDisplayStatus({ status: "draft", syncState: "synced" })).toBe("pending");
    expect(paymentDisplayStatus({ status: "posted", syncState: "pending" })).toBe("pending");
    expect(paymentDisplayStatus({ status: "posted", syncState: "conflict" })).toBe("failed");
    expect(paymentDisplayStatus({ status: "posted", syncState: "rejected" })).toBe("failed");
    expect(paymentDisplayStatus({ status: "void", syncState: "synced" })).toBe("reversed");
  });

  it("treats card and wallet kinds as record-only (no gateway settlement)", () => {
    expect(isRecordOnlyPaymentKind("cash")).toBe(false);
    expect(isRecordOnlyPaymentKind("bank")).toBe(false);
    expect(isRecordOnlyPaymentKind("card")).toBe(true);
    expect(isRecordOnlyPaymentKind("jazzcash")).toBe(true);
    expect(isRecordOnlyPaymentKind("easypaisa")).toBe(true);
    expect(isRecordOnlyPaymentKind("sadapay")).toBe(true);
    expect(isRecordOnlyPaymentKind("online")).toBe(true);
  });

  it("searches receipt, invoice, and customer without requiring an id paste", () => {
    const row = {
      receiptNumber: "RCV-100",
      invoiceNumber: "INV-9",
      customerName: "Ahmed Traders",
      status: "posted",
      syncState: "synced",
    };
    expect(matchesPaymentRegister(row, "RCV-100")).toBe(true);
    expect(matchesPaymentRegister(row, "inv-9")).toBe(true);
    expect(matchesPaymentRegister(row, "ahmed")).toBe(true);
    expect(matchesPaymentRegister(row, "missing")).toBe(false);
    expect(matchesPaymentRegister(row, "", "recorded")).toBe(true);
    expect(matchesPaymentRegister(row, "", "failed")).toBe(false);
  });

  it("summarizes recorded amounts from posted synced rows", () => {
    const summary = summarizePaymentRegister(
      [
        {
          status: "posted",
          syncState: "synced",
          totalAmount: 100,
          occurredAt: "2026-08-16T10:00:00.000Z",
        },
        {
          status: "void",
          syncState: "synced",
          totalAmount: 50,
          occurredAt: "2026-08-16T11:00:00.000Z",
        },
      ],
      new Date("2026-08-16T12:00:00.000Z"),
    );
    expect(summary.recordedCount).toBe(1);
    expect(summary.recordedAmount).toBe(100);
    expect(summary.reversedCount).toBe(1);
    expect(summary.todayCount).toBe(2);
  });
});
