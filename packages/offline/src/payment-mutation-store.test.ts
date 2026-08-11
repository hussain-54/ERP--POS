import { describe, expect, it, vi } from "vitest";
import { OfflinePaymentMutationStore } from "./payment-mutation-store.js";
import { SyncEngine } from "@electronic-erp/sync";

const org = "11111111-1111-4111-8111-111111111111";
const branch = "22222222-2222-4222-8222-222222222222";
const customer = "33333333-3333-4333-8333-333333333333";
const method = "44444444-4444-4444-8444-444444444444";
const device = "55555555-5555-4555-8555-555555555555";

describe("offline payments", () => {
  it("applies payment and prevents duplicates via idempotency", () => {
    const store = new OfflinePaymentMutationStore();
    store.seedCustomerOutstanding(customer, "50000");
    const idempotencyKey = "66666666-6666-4666-8666-666666666666";
    const payload = {
      organizationId: org,
      branchId: branch,
      direction: "receive" as const,
      partyType: "customer" as const,
      customerId: customer,
      splits: [{ paymentMethodId: method, amount: "20000" }],
      billTotal: "20000",
      idempotencyKey,
      operationId: idempotencyKey,
    };
    const first = store.applyOfflinePayment({
      payment: payload,
      deviceId: device,
      offlineTransactionId: "77777777-7777-4777-8777-777777777777",
      entityId: "88888888-8888-4888-8888-888888888888",
    });
    const second = store.applyOfflinePayment({
      payment: payload,
      deviceId: device,
      offlineTransactionId: "77777777-7777-4777-8777-777777777777",
      entityId: "99999999-9999-4999-8999-999999999999",
    });
    expect(first.id).toBe(second.id);
    expect(store.getOutstanding(customer)).toBe("30000");
    expect(store.listPending()).toHaveLength(1);
  });

  it("flushes through sync abstraction", async () => {
    const store = new OfflinePaymentMutationStore();
    store.seedCustomerOutstanding(customer, "10000");
    const key = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    store.applyOfflinePayment({
      payment: {
        organizationId: org,
        branchId: branch,
        direction: "receive",
        partyType: "customer",
        customerId: customer,
        splits: [{ paymentMethodId: method, amount: "10000" }],
        idempotencyKey: key,
        operationId: key,
      },
      deviceId: device,
      offlineTransactionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      entityId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    });
    const push = vi.fn(async () => ({ accepted: 1, conflicts: 0 }));
    const engine = new SyncEngine({
      push,
      pull: async () => ({ cursor: null, rows: [] }),
    });
    expect(await store.flush(engine)).toBe(1);
    expect(store.listPending()).toHaveLength(0);
  });
});
