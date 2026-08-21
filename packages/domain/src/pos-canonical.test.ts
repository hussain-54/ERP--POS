import { describe, expect, it } from "vitest";
import {
  POS_SOURCE_OF_TRUTH,
  POS_TRANSACTION_PIPELINE,
  POS_UI_MUST_NOT_OWN,
} from "./pos-canonical";

describe("POS canonical transaction model", () => {
  it("locks the posting pipeline order", () => {
    expect(POS_TRANSACTION_PIPELINE[0]).toBe("session");
    expect(POS_TRANSACTION_PIPELINE).toContain("totals");
    expect(POS_TRANSACTION_PIPELINE).toContain("post_sale");
    expect(POS_TRANSACTION_PIPELINE[POS_TRANSACTION_PIPELINE.length - 1]).toBe(
      "post_commit_side_effects",
    );
  });

  it("points money math at domain modules, not UI", () => {
    expect(POS_SOURCE_OF_TRUTH.totals).toMatch(/sale-totals/);
    expect(POS_SOURCE_OF_TRUTH.salePosting).toMatch(/sale-transaction/);
    expect(POS_SOURCE_OF_TRUTH.paymentPrep).toMatch(/pos-payment/);
    expect(POS_UI_MUST_NOT_OWN).toContain("grand_total");
    expect(POS_UI_MUST_NOT_OWN).toContain("idempotent_sale_post");
  });
});
