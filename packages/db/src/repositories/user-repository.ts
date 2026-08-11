import type { UserProfile } from "@electronic-erp/contracts";
import type { DatabaseClient } from "../client.js";

/** Data-access only — no business rules. */
export class UserRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findByAuthUserId(authUserId: string): Promise<UserProfile | null> {
    const { data, error } = await this.db
      .from("user_profiles")
      .select("*")
      .eq("auth_user_id", authUserId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapUserProfile(data);
  }

  async listBranchIds(userId: string): Promise<string[]> {
    const { data, error } = await this.db
      .from("branch_memberships")
      .select("branch_id")
      .eq("user_id", userId);

    if (error) throw error;
    return (data ?? []).map((row) => row.branch_id as string);
  }

  async listPermissionKeys(userId: string): Promise<string[]> {
    const { data, error } = await this.db.rpc("get_user_permission_keys", {
      p_user_id: userId,
    });
    if (error) {
      // Foundation fallback when RPC not yet applied in local env
      if (error.message.includes("get_user_permission_keys")) return [];
      throw error;
    }
    return (data as string[] | null) ?? [];
  }
}

function mapUserProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    authUserId: String(row.auth_user_id),
    organizationId: String(row.organization_id),
    email: String(row.email),
    fullName: String(row.full_name),
    phone: (row.phone as string | null) ?? null,
    isActive: Boolean(row.is_active),
    defaultBranchId: (row.default_branch_id as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdBy: (row.created_by as string | null) ?? null,
    updatedBy: (row.updated_by as string | null) ?? null,
    deletedAt: (row.deleted_at as string | null) ?? null,
    version: Number(row.version ?? 1),
  };
}
