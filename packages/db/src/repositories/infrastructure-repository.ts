import type {
  CreateBackupJobSchema,
  CreateIntegrationClientSchema,
  CreateRestorePointSchema,
  RegisterSecurityDeviceSchema,
  RequestRestoreSchema,
  TwoFactorSetupSchema,
  UpsertSecuritySettingsSchema,
} from "@electronic-erp/contracts";
import {
  DEFAULT_PASSWORD_POLICY,
  encryptionStrategySummary,
  generateApiKeyMaterial,
  hashApiKey,
  isAccountLocked,
  nextLockoutUntil,
  planBackupJob,
  type PasswordPolicy,
} from "@electronic-erp/domain";
import type { z } from "zod";
import type { DatabaseClient } from "../client.js";

type Row = Record<string, unknown>;
type SecuritySettingsInput = z.infer<typeof UpsertSecuritySettingsSchema>;
type DeviceInput = z.infer<typeof RegisterSecurityDeviceSchema>;
type TwoFactorInput = z.infer<typeof TwoFactorSetupSchema>;
type BackupJobInput = z.infer<typeof CreateBackupJobSchema>;
type RestorePointInput = z.infer<typeof CreateRestorePointSchema>;
type RestoreRequestInput = z.infer<typeof RequestRestoreSchema>;
type IntegrationInput = z.infer<typeof CreateIntegrationClientSchema>;

function str(v: unknown): string {
  return String(v ?? "");
}
function num(v: unknown): number {
  return Number(v ?? 0) || 0;
}

export class InfrastructureRepository {
  constructor(private readonly db: DatabaseClient) {}

  async getSecuritySettings(organizationId: string) {
    const { data } = await this.db
      .from("security_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();
    const policy = {
      ...DEFAULT_PASSWORD_POLICY,
      ...((data?.password_policy_json as PasswordPolicy | undefined) ?? {}),
    };
    return {
      organization_id: organizationId,
      password_policy: policy,
      encryption_strategy: data?.encryption_strategy ?? "supabase_at_rest",
      two_factor_optional: data?.two_factor_optional ?? true,
      two_factor_enforced: data?.two_factor_enforced ?? false,
      notes: data?.notes ?? null,
      encryption: encryptionStrategySummary(),
    };
  }

  async upsertSecuritySettings(input: SecuritySettingsInput, userId: string | null) {
    const policy = { ...DEFAULT_PASSWORD_POLICY, ...input.passwordPolicy };
    const { data, error } = await this.db
      .from("security_settings")
      .upsert(
        {
          organization_id: input.organizationId,
          password_policy_json: policy,
          encryption_strategy: input.encryptionStrategy ?? "supabase_at_rest",
          two_factor_optional: policy.twoFactorOptional,
          two_factor_enforced: policy.twoFactorEnforced,
          notes: input.notes ?? null,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        },
        { onConflict: "organization_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async recordLoginAttempt(input: {
    organizationId?: string | null;
    email: string;
    userId?: string | null;
    success: boolean;
    ipAddress?: string;
    userAgent?: string;
    failureReason?: string;
  }) {
    await this.db.from("login_history").insert({
      organization_id: input.organizationId ?? null,
      email: input.email.toLowerCase(),
      user_id: input.userId ?? null,
      success: input.success,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      failure_reason: input.failureReason ?? null,
    });
  }

  async findOrgIdByEmail(email: string): Promise<string | null> {
    const { data } = await this.db
      .from("user_profiles")
      .select("organization_id")
      .eq("email", email.toLowerCase())
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    return data?.organization_id ? str(data.organization_id) : null;
  }

  async getLockout(organizationId: string, email: string) {
    const { data } = await this.db
      .from("login_lockouts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("email", email.toLowerCase())
      .maybeSingle();
    return data;
  }

  async registerFailedLogin(organizationId: string, email: string, policy: PasswordPolicy) {
    const current = await this.getLockout(organizationId, email);
    const failed = num(current?.failed_attempts) + 1;
    const locked =
      failed >= policy.maxFailedAttempts
        ? nextLockoutUntil(policy.lockoutMinutes)
        : (current?.locked_until ?? null);
    const { data, error } = await this.db
      .from("login_lockouts")
      .upsert(
        {
          organization_id: organizationId,
          email: email.toLowerCase(),
          failed_attempts: failed,
          locked_until: locked,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,email" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async clearLockout(organizationId: string, email: string) {
    await this.db.from("login_lockouts").upsert(
      {
        organization_id: organizationId,
        email: email.toLowerCase(),
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,email" },
    );
  }

  async assertNotLocked(organizationId: string, email: string, policy: PasswordPolicy) {
    const row = await this.getLockout(organizationId, email);
    const check = isAccountLocked({
      failedAttempts: num(row?.failed_attempts),
      lockedUntil: row?.locked_until ? str(row.locked_until) : null,
      maxFailedAttempts: policy.maxFailedAttempts,
    });
    if (check.locked) throw new Error(check.reason ?? "Account locked");
  }

  async listLoginHistory(organizationId: string) {
    const { data, error } = await this.db
      .from("login_history")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  }

  async createSession(input: {
    organizationId: string;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt?: string;
  }) {
    const { data, error } = await this.db
      .from("user_sessions")
      .insert({
        organization_id: input.organizationId,
        user_id: input.userId,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        expires_at: input.expiresAt ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listSessions(organizationId: string, userId?: string) {
    let q = this.db
      .from("user_sessions")
      .select("*")
      .eq("organization_id", organizationId)
      .is("revoked_at", null)
      .order("last_seen_at", { ascending: false })
      .limit(100);
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async revokeSession(organizationId: string, sessionId: string) {
    const { data, error } = await this.db
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("organization_id", organizationId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async logActivity(input: {
    organizationId: string;
    userId?: string | null;
    action: string;
    entityType?: string;
    entityId?: string;
    detail?: Record<string, unknown>;
  }) {
    await this.db.from("activity_logs").insert({
      organization_id: input.organizationId,
      user_id: input.userId ?? null,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      detail_json: input.detail ?? {},
    });
  }

  async listActivity(organizationId: string) {
    const { data, error } = await this.db
      .from("activity_logs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  }

  async registerDevice(input: DeviceInput, userId: string | null) {
    const { data, error } = await this.db
      .from("security_devices")
      .upsert(
        {
          organization_id: input.organizationId,
          user_id: userId,
          device_label: input.deviceLabel,
          device_fingerprint: input.deviceFingerprint,
          platform: input.platform ?? null,
          status: "pending",
        },
        { onConflict: "organization_id,device_fingerprint" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async setDeviceStatus(
    organizationId: string,
    deviceId: string,
    status: "approved" | "revoked",
  ) {
    const patch: Row = { status };
    if (status === "approved") patch.approved_at = new Date().toISOString();
    if (status === "revoked") patch.revoked_at = new Date().toISOString();
    const { data, error } = await this.db
      .from("security_devices")
      .update(patch)
      .eq("id", deviceId)
      .eq("organization_id", organizationId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listDevices(organizationId: string) {
    const { data, error } = await this.db
      .from("security_devices")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  }

  async upsertTwoFactor(input: TwoFactorInput) {
    const { data, error } = await this.db
      .from("user_two_factor")
      .upsert(
        {
          user_id: input.userId,
          organization_id: input.organizationId,
          method: input.method ?? "totp",
          enabled: input.enabled,
          secret_configured: false, // architecture-ready; secrets never returned to clients
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("user_id,organization_id,method,enabled,secret_configured,updated_at")
      .single();
    if (error) throw error;
    return {
      ...data,
      note: "Optional 2FA architecture only — authenticator enrollment is not fully wired.",
    };
  }

  // ─── Backup ───────────────────────────────────────────
  async createBackupJob(input: BackupJobInput, userId: string | null) {
    const plan = planBackupJob({
      mode: input.mode ?? "daily",
      target: input.target ?? "local",
      encrypted: input.encrypted ?? true,
    });
    const { data, error } = await this.db
      .from("backup_jobs")
      .insert({
        organization_id: input.organizationId,
        mode: input.mode ?? "daily",
        target: input.target ?? "local",
        encrypted: input.encrypted ?? true,
        status: "queued",
        label: input.label ?? null,
        scheduled_for: plan.scheduledFor,
        notes: plan.notes.join(" "),
        disaster_recovery_claimed: false,
        storage_path: `backups/${input.organizationId}/${Date.now()}.enc`,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { item: data, plan };
  }

  async listBackupJobs(organizationId: string) {
    const { data, error } = await this.db
      .from("backup_jobs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  }

  async createRestorePoint(input: RestorePointInput, userId: string | null) {
    const { data, error } = await this.db
      .from("backup_restore_points")
      .insert({
        organization_id: input.organizationId,
        backup_job_id: input.backupJobId ?? null,
        label: input.label,
        notes: input.notes ?? null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listRestorePoints(organizationId: string) {
    const { data, error } = await this.db
      .from("backup_restore_points")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  }

  async requestRestore(input: RestoreRequestInput, userId: string | null) {
    const verifyOnly = input.verifyOnly ?? true;
    const { data, error } = await this.db
      .from("backup_restore_requests")
      .insert({
        organization_id: input.organizationId,
        restore_point_id: input.restorePointId,
        verify_only: verifyOnly,
        status: verifyOnly ? "verified" : "requested",
        result_notes: verifyOnly
          ? "Verification-only request recorded. Full disaster recovery restore is not claimed until a tested restore completes."
          : "Restore requested — awaiting operator confirmation and tested restore procedure.",
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return {
      item: data,
      disasterRecoveryClaimed: false,
    };
  }

  // ─── Integrations ─────────────────────────────────────
  async createIntegrationClient(input: IntegrationInput, userId: string | null) {
    const { rawKey, prefix } = generateApiKeyMaterial(input.audience);
    const { data, error } = await this.db
      .from("integration_clients")
      .insert({
        organization_id: input.organizationId,
        name: input.name,
        audience: input.audience,
        key_prefix: prefix,
        key_hash: hashApiKey(rawKey),
        scopes: input.scopes?.length ? input.scopes : ["read"],
        webhook_url: input.webhookUrl ?? null,
        created_by: userId,
      })
      .select("id,organization_id,name,audience,key_prefix,scopes,webhook_url,is_active,created_at")
      .single();
    if (error) throw error;
    return {
      item: data,
      apiKeyOnce: rawKey,
      apiBasePath: "/api/v1",
      note: "Store the API key now — it is never returned again. Service-role keys never ship to the frontend.",
    };
  }

  async listIntegrationClients(organizationId: string) {
    const { data, error } = await this.db
      .from("integration_clients")
      .select("id,name,audience,key_prefix,scopes,webhook_url,is_active,created_at,last_used_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  }

  async revokeIntegrationClient(organizationId: string, clientId: string) {
    const { data, error } = await this.db
      .from("integration_clients")
      .update({ is_active: false })
      .eq("id", clientId)
      .eq("organization_id", organizationId)
      .select("id,name,is_active")
      .single();
    if (error) throw error;
    return data;
  }

  async auditPriceChange(input: {
    organizationId: string;
    productId?: string;
    sku?: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    reason?: string;
    userId?: string | null;
  }) {
    await this.db.from("price_change_audits").insert({
      organization_id: input.organizationId,
      product_id: input.productId ?? null,
      sku: input.sku ?? null,
      before_json: input.before,
      after_json: input.after,
      reason: input.reason ?? null,
      created_by: input.userId ?? null,
    });
  }
}
