import { describe, expect, it, vi } from "vitest";
import { OfflineCustomerStore } from "./customer-store.js";
import { SyncEngine } from "@electronic-erp/sync";

const org = "11111111-1111-4111-8111-111111111111";

describe("OfflineCustomerStore", () => {
  it("creates, searches, updates, and switches customers offline", () => {
    const store = new OfflineCustomerStore();
    const a = store.create({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      organizationId: org,
      code: "A1",
      name: "Walk Existing",
      mobile: "03001111111",
      email: "a@example.com",
      customerType: "retail",
      creditLimit: "5000",
    });
    const b = store.create({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      organizationId: org,
      code: "B1",
      name: "Dealer Co",
      mobile: "03002222222",
      customerType: "dealer",
      creditLimit: "20000",
      cnic: "35202-9999999-9",
    });

    expect(store.search(org, "Dealer")[0]?.id).toBe(b.id);
    expect(store.search(org, "a@example")[0]?.id).toBe(a.id);

    const updated = store.update(a.id, { name: "Walk Existing Updated", creditLimit: "8000" });
    expect(updated.name).toBe("Walk Existing Updated");
    expect(store.get(a.id)?.creditLimit).toBe("8000");
    expect(store.get(b.id)?.customerType).toBe("dealer");
  });

  it("flushes customer upserts through sync entity customers", async () => {
    const store = new OfflineCustomerStore();
    store.create({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      organizationId: org,
      code: "C1",
      name: "Offline New",
      customerType: "wholesale",
    });
    const push = vi.fn(async () => ({ accepted: 1, conflicts: 0 }));
    const engine = new SyncEngine({
      push,
      pull: async () => ({ cursor: null, rows: [] }),
    });
    const accepted = await store.flush(engine, "device-1");
    expect(accepted).toBe(1);
    expect(store.listPendingSync().length).toBe(0);
    expect(push).toHaveBeenCalledTimes(1);
  });
});
