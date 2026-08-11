import type { OfflinePaymentMutation, PostSplitPaymentInput } from "@electronic-erp/contracts";
import { assertSplitMatchesBill, applyCustomerLedgerEffect } from "@electronic-erp/domain";
import { enqueuePayment, type SyncEngine } from "@electronic-erp/sync";

/** Offline payment engine with duplicate prevention via idempotency keys. */
export class OfflinePaymentMutationStore {
  private readonly mutations: OfflinePaymentMutation[] = [];
  private readonly byIdempotency = new Map<string, OfflinePaymentMutation>();
  private readonly customerOutstanding = new Map<string, string>();

  seedCustomerOutstanding(customerId: string, outstanding: string): void {
    this.customerOutstanding.set(customerId, outstanding);
  }

  getOutstanding(customerId: string): string {
    return this.customerOutstanding.get(customerId) ?? "0";
  }

  applyOfflinePayment(input: {
    payment: PostSplitPaymentInput;
    deviceId: string;
    offlineTransactionId: string;
    entityId: string;
  }): OfflinePaymentMutation {
    const key = `${input.payment.organizationId}:${input.payment.idempotencyKey}`;
    const existing = this.byIdempotency.get(key);
    if (existing) return existing;

    const total = assertSplitMatchesBill(
      input.payment.splits.map((s) => ({
        paymentMethodId: s.paymentMethodId,
        amount: s.amount,
      })),
      input.payment.billTotal,
    );

    if (input.payment.customerId) {
      const current = this.getOutstanding(input.payment.customerId);
      const effect = applyCustomerLedgerEffect(current, "payment", total);
      this.customerOutstanding.set(input.payment.customerId, effect.balanceAfter);
    }

    const mutation: OfflinePaymentMutation = {
      id: input.entityId,
      organizationId: input.payment.organizationId,
      deviceId: input.deviceId,
      offlineTransactionId: input.offlineTransactionId,
      operationId: input.payment.operationId ?? input.payment.idempotencyKey,
      entityId: input.entityId,
      entityType: "payment",
      payload: input.payment as unknown as Record<string, unknown>,
      timestamp: new Date().toISOString(),
      version: 1,
      syncState: "pending",
    };
    this.mutations.push(mutation);
    this.byIdempotency.set(key, mutation);
    return mutation;
  }

  listPending(): OfflinePaymentMutation[] {
    return this.mutations.filter((m) => m.syncState === "pending");
  }

  async flush(engine: SyncEngine): Promise<number> {
    let accepted = 0;
    for (const mutation of this.listPending()) {
      const result = await enqueuePayment(
        engine,
        mutation.deviceId,
        mutation.payload as unknown as PostSplitPaymentInput,
        mutation.operationId,
      );
      if (!result.deferred && result.accepted > 0) {
        mutation.syncState = "synced";
        accepted += 1;
      }
    }
    return accepted;
  }
}
