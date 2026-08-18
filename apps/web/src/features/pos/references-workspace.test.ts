import { describe, expect, it } from "vitest";
import { buildReferenceRegister, parseReferenceDirectory, REFERENCE_TABLE_COLUMNS } from "./references-workspace";

describe("references workspace", () => {
  it("locks register columns and joins real directory records onto sales", () => {
    expect([...REFERENCE_TABLE_COLUMNS]).toEqual([
      "Reference #",
      "Type",
      "Customer",
      "Invoice",
      "Salesman",
      "Amount",
      "Date",
      "Status",
      "Action",
    ]);
    const directory = parseReferenceDirectory([
      { id: "r1", name: "Dealer A", reference_code: "REF-1", reference_type: "dealer", is_active: true },
      { id: "r2", name: "Unused", reference_code: "REF-2", reference_type: "outside", is_active: true },
    ]);
    const rows = buildReferenceRegister(directory, [
      {
        id: "s1",
        referenceId: "r1",
        invoiceNumber: "INV-1",
        customerName: "Ahmed",
        salesmanName: "Ali",
        grandTotal: 2500,
        status: "posted",
        createdAt: "2026-08-16T10:00:00.000Z",
      },
    ]);
    expect(rows[0]).toMatchObject({
      referenceNumber: "REF-1",
      type: "dealer",
      customer: "Ahmed",
      invoice: "INV-1",
      salesman: "Ali",
      amount: 2500,
    });
    expect(rows.some((row) => row.referenceNumber === "REF-2" && row.invoice === "—")).toBe(true);
  });
});
