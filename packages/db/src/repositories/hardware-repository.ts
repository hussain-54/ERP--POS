import type { OpenCashDrawerInput } from "@electronic-erp/contracts";
import type { DatabaseClient } from "../client.js";

export class HardwareRepository {
  constructor(private readonly db: DatabaseClient) {}

  async enqueuePrintJob(input: {
    organizationId: string;
    branchId?: string;
    documentType: string;
    media: string;
    payload: string;
    copies?: number;
  }, userId?: string | null) {
    const { data, error } = await this.db
      .from("print_jobs")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId ?? null,
        document_type: input.documentType,
        media: input.media,
        status: "queued",
        payload: input.payload,
        copies: input.copies ?? 1,
        requested_by: userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listPrintJobs(organizationId: string) {
    const { data, error } = await this.db
      .from("print_jobs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  }

  async markPrintJob(id: string, status: "done" | "failed" | "retrying", errorMessage?: string) {
    const { data, error } = await this.db
      .from("print_jobs")
      .update({
        status,
        error_message: errorMessage ?? null,
        completed_at: status === "done" || status === "failed" ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async recordDrawerOpen(input: OpenCashDrawerInput, userId?: string | null, status = "connected") {
    const { data, error } = await this.db
      .from("hardware_events")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId ?? null,
        capability: "cash_drawer",
        status,
        message: input.reason ?? "Cash drawer open",
        actor_user_id: userId ?? null,
        payload: { action: "cash_drawer.open", reason: input.reason ?? null },
      })
      .select("*")
      .single();
    if (error) throw error;

    await this.db.from("audit_logs").insert({
      organization_id: input.organizationId,
      branch_id: input.branchId ?? null,
      actor_user_id: userId ?? null,
      actor_kind: "other",
      action: "cash_drawer.open",
      entity_type: "cash_drawer",
      after: { reason: input.reason ?? null, status },
    });

    return data;
  }

  async listHardwareEvents(organizationId: string) {
    const { data, error } = await this.db
      .from("hardware_events")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  }
}
