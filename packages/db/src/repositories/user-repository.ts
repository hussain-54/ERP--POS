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

  async listRoleNames(userId: string): Promise<string[]> {
    const { data, error } = await this.db
      .from("user_roles")
      .select("roles(name,code)")
      .eq("user_id", userId);
    if (error) {
      if (String(error.message).includes("user_roles") || String(error.message).includes("roles")) {
        return [];
      }
      throw error;
    }
    const names: string[] = [];
    for (const row of data ?? []) {
      const roles = (row as { roles?: { name?: string; code?: string } | null }).roles;
      if (roles?.name) names.push(String(roles.name));
      else if (roles?.code) names.push(String(roles.code));
    }
    return [...new Set(names)];
  }

  async updateOwnProfile(
    userId: string,
    input: {
      fullName?: string;
      phone?: string | null;
      defaultBranchId?: string | null;
      avatarUrl?: string | null;
    },
  ): Promise<UserProfile> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.fullName !== undefined) patch.full_name = input.fullName;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.defaultBranchId !== undefined) patch.default_branch_id = input.defaultBranchId;
    if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;

    const { data, error } = await this.db
      .from("user_profiles")
      .update(patch)
      .eq("id", userId)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) throw error;
    return mapUserProfile(data as Record<string, unknown>);
  }

  async getLastSuccessfulLoginAt(organizationId: string, email: string): Promise<string | null> {
    const { data, error } = await this.db
      .from("login_history")
      .select("created_at")
      .eq("organization_id", organizationId)
      .eq("email", email)
      .eq("success", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (String(error.message).includes("login_history")) return null;
      throw error;
    }
    return data?.created_at ? String(data.created_at) : null;
  }

  async getBranchName(branchId: string | null | undefined): Promise<string | null> {
    if (!branchId) return null;
    const { data, error } = await this.db.from("branches").select("name,code").eq("id", branchId).maybeSingle();
    if (error || !data) return null;
    return String((data as { name?: string; code?: string }).name ?? (data as { code?: string }).code ?? branchId);
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
