import {
  LoginSchema,
  PasswordResetRequestSchema,
  SignupSchema,
  type ChangePasswordInput,
  type LoginInput,
  type PasswordResetRequestInput,
  type SignupInput,
  type UpdateOwnProfileInput,
  type UserProfile,
} from "@electronic-erp/contracts";
import { AdminRepository, InfrastructureRepository, UserRepository } from "@electronic-erp/db";
import { DEFAULT_PASSWORD_POLICY, DomainError, validatePasswordAgainstPolicy } from "@electronic-erp/domain";
import {
  createAnonClient,
  createServiceClient,
  createUserClient,
} from "../lib/supabase.js";
import { supabaseConfigured } from "../config.js";
import { log } from "../lib/logger.js";

export class AuthService {
  private infraRepo() {
    const svc = createServiceClient();
    return svc ? new InfrastructureRepository(svc) : null;
  }

  /** Audit/settings helpers must not block login when migrations/tables are incomplete. */
  private async softInfra(label: string, fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      if (err instanceof DomainError) throw err;
      log.warn({
        category: "api",
        message: `auth infra soft-fail: ${label}`,
        err,
      });
    }
  }

  async signup(
    raw: SignupInput,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const input = SignupSchema.parse(raw);
    if (!supabaseConfigured()) {
      throw new DomainError(
        "Supabase is not configured on the API (set SUPABASE_URL + anon/publishable key)",
        "UNAUTHORIZED",
      );
    }

    if (input.confirmPassword && input.password !== input.confirmPassword) {
      throw new DomainError("Passwords do not match", "BAD_REQUEST");
    }

    const policyValidation = validatePasswordAgainstPolicy(input.password, DEFAULT_PASSWORD_POLICY);
    if (!policyValidation.ok) {
      throw new DomainError(policyValidation.errors[0] ?? "Password policy check failed", "BAD_REQUEST");
    }

    const serviceClient = createServiceClient();
    const anonClient = createAnonClient();

    let authUserId: string;

    if (serviceClient) {
      // Check existing profile by email
      const { data: existingProfile } = await serviceClient
        .from("user_profiles")
        .select("id")
        .eq("email", input.email)
        .is("deleted_at", null)
        .maybeSingle();

      if (existingProfile) {
        throw new DomainError("An account with this email already exists", "CONFLICT");
      }

      const { data: authData, error: authErr } = await serviceClient.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { full_name: input.fullName },
      });

      if (authErr || !authData.user) {
        throw new DomainError(authErr?.message ?? "Failed to create user account", "BAD_REQUEST");
      }
      authUserId = authData.user.id;
    } else {
      const { data: authData, error: authErr } = await anonClient.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: { full_name: input.fullName },
        },
      });
      if (authErr || !authData.user) {
        throw new DomainError(authErr?.message ?? "Failed to create user account", "BAD_REQUEST");
      }
      authUserId = authData.user.id;
    }

    const dbClient = serviceClient ?? anonClient;

    // Create new organization
    const { data: org, error: orgErr } = await dbClient
      .from("organizations")
      .insert({
        name: input.companyName,
        legal_name: input.companyName,
      })
      .select("*")
      .single();

    if (orgErr || !org) {
      if (serviceClient) await serviceClient.auth.admin.deleteUser(authUserId).catch(() => null);
      throw new DomainError(orgErr?.message ?? "Failed to create organization", "BAD_REQUEST");
    }

    const orgId = String(org.id);

    // Create default main branch
    const { data: branch, error: branchErr } = await dbClient
      .from("branches")
      .insert({
        organization_id: orgId,
        code: "MAIN",
        name: "Main Branch",
        settings: { is_main: true },
      })
      .select("*")
      .single();

    if (branchErr || !branch) {
      throw new DomainError(branchErr?.message ?? "Failed to initialize main branch", "BAD_REQUEST");
    }

    const branchId = String(branch.id);

    // Seed 12 system roles for this organization
    const adminRepo = new AdminRepository(dbClient);
    await adminRepo.seedSystemRoles(orgId).catch((err) => {
      log.warn({ category: "api", message: "seedSystemRoles soft-fail during signup", err });
    });

    // Create user profile
    const { data: profileRow, error: profileErr } = await dbClient
      .from("user_profiles")
      .insert({
        auth_user_id: authUserId,
        organization_id: orgId,
        email: input.email,
        full_name: input.fullName,
        phone: input.phone ?? null,
        avatar_url: input.avatarUrl ?? null,
        default_branch_id: branchId,
        is_active: true,
      })
      .select("*")
      .single();

    if (profileErr || !profileRow) {
      throw new DomainError(profileErr?.message ?? "Failed to initialize user profile", "BAD_REQUEST");
    }

    const profileId = String(profileRow.id);

    // Assign owner role to organization creator
    try {
      await adminRepo.assignUserRole({
        organizationId: orgId,
        userId: profileId,
        roleCode: "owner",
        branchId,
      });
    } catch (err) {
      log.warn({ category: "api", message: "assignUserRole soft-fail during signup", err });
    }

    // Assign branch membership
    try {
      await dbClient.from("branch_memberships").insert({
        organization_id: orgId,
        user_id: profileId,
        branch_id: branchId,
      });
    } catch (err) {
      log.warn({ category: "api", message: "branch_memberships soft-fail during signup", err });
    }

    // Authenticate and return session
    return this.login({ email: input.email, password: input.password }, meta);
  }

  async login(
    raw: LoginInput,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const input = LoginSchema.parse(raw);
    if (!supabaseConfigured()) {
      throw new DomainError(
        "Supabase is not configured on the API (set SUPABASE_URL + anon/publishable key)",
        "UNAUTHORIZED",
      );
    }

    const infra = this.infraRepo();
    if (infra) {
      try {
        const orgHint = await infra.findOrgIdByEmail(input.email);
        if (orgHint) {
          const settings = await infra.getSecuritySettings(orgHint);
          await infra.assertNotLocked(orgHint, input.email, settings.password_policy);
        }
      } catch (err) {
        if (err instanceof DomainError) throw err;
        log.warn({ category: "api", message: "pre-login lockout skipped", err });
      }
    }

    const client = createAnonClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.session || !data.user) {
      if (infra) {
        await this.softInfra("recordFailedLogin", async () => {
          const orgId = await infra.findOrgIdByEmail(input.email);
          await infra.recordLoginAttempt({
            organizationId: orgId,
            email: input.email,
            success: false,
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
            failureReason: error?.message ?? "Login failed",
          });
          if (orgId) {
            const settings = await infra.getSecuritySettings(orgId);
            await infra.registerFailedLogin(orgId, input.email, settings.password_policy);
          }
        });
      }
      throw new DomainError(error?.message ?? "Login failed", "UNAUTHORIZED");
    }

    const userClient = createUserClient(data.session.access_token);
    const repo = new UserRepository(userClient);
    const serviceClient = createServiceClient();
    let profile = await repo.findByAuthUserId(data.user.id);
    if (!profile && serviceClient) {
      profile = await new UserRepository(serviceClient).findByAuthUserId(data.user.id);
    }
    if (!profile) {
      if (infra) {
        await this.softInfra("recordProfileMissing", () =>
          infra.recordLoginAttempt({
            email: input.email,
            success: false,
            failureReason: "User profile not found",
          }),
        );
      }
      throw new DomainError(
        "User profile not found. Complete onboarding / seed profile.",
        "UNAUTHORIZED",
      );
    }

    const orgId = String(profile.organizationId);
    let policy = DEFAULT_PASSWORD_POLICY;
    if (infra) {
      try {
        const settings = await infra.getSecuritySettings(orgId);
        policy = settings.password_policy ?? DEFAULT_PASSWORD_POLICY;
        await infra.assertNotLocked(orgId, input.email, policy);
      } catch (err) {
        if (err instanceof DomainError) {
          await client.auth.signOut();
          throw err;
        }
        log.warn({ category: "api", message: "post-auth security skipped", err });
      }
    }

    if (policy.twoFactorEnforced && infra) {
      try {
        const { data: tfa } = await userClient
          .from("user_two_factor")
          .select("enabled")
          .eq("user_id", profile.id)
          .maybeSingle();
        if (!tfa?.enabled) {
          await this.softInfra("2fa_pending_log", () =>
            infra.logActivity({
              organizationId: orgId,
              userId: profile.id,
              action: "security.2fa_enforcement_pending",
              detail: { note: "2FA enforced in policy but user not enrolled" },
            }),
          );
        }
      } catch (err) {
        log.warn({ category: "api", message: "2fa check skipped", err });
      }
    }

    const authzRepo = serviceClient ? new UserRepository(serviceClient) : repo;
    const [permissions, branches] = await Promise.all([
      authzRepo.listPermissionKeys(profile.id),
      authzRepo.listBranchIds(profile.id),
    ]);

    if (infra) {
      await this.softInfra("postLoginAudit", async () => {
        await infra.clearLockout(orgId, input.email);
        await infra.recordLoginAttempt({
          organizationId: orgId,
          email: input.email,
          userId: profile.id,
          success: true,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        });
        await infra.createSession({
          organizationId: orgId,
          userId: profile.id,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          expiresAt: data.session.expires_at
            ? new Date(Number(data.session.expires_at) * 1000).toISOString()
            : undefined,
        });
        await infra.logActivity({
          organizationId: orgId,
          userId: profile.id,
          action: "auth.login",
          detail: { email: input.email },
        });
      });
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
      user: profile,
      permissions,
      branches,
      security: {
        twoFactorOptional: policy.twoFactorOptional,
        twoFactorEnforced: policy.twoFactorEnforced,
      },
    };
  }

  async logout(accessToken: string): Promise<void> {
    if (!supabaseConfigured()) return;
    const client = createUserClient(accessToken);
    await client.auth.signOut();
  }

  async requestPasswordReset(raw: PasswordResetRequestInput): Promise<void> {
    const input = PasswordResetRequestSchema.parse(raw);
    if (!supabaseConfigured()) {
      throw new DomainError("Supabase is not configured", "UNAUTHORIZED");
    }
    const client = createAnonClient();
    const origin =
      process.env.API_CORS_ORIGIN ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5173");
    const { error } = await client.auth.resetPasswordForEmail(input.email, {
      redirectTo: `${origin}/auth/reset`,
    });
    if (error) throw new DomainError(error.message, "UNAUTHORIZED");
  }

  async restoreSession(accessToken: string) {
    if (!supabaseConfigured()) {
      throw new DomainError("Supabase is not configured", "UNAUTHORIZED");
    }
    const userClient = createUserClient(accessToken);
    const { data, error } = await userClient.auth.getUser();
    if (error || !data.user) {
      throw new DomainError("Invalid session", "UNAUTHORIZED");
    }

    const repo = new UserRepository(userClient);
    const serviceClient = createServiceClient();
    let profile = await repo.findByAuthUserId(data.user.id);
    if (!profile && serviceClient) {
      profile = await new UserRepository(serviceClient).findByAuthUserId(data.user.id);
    }
    if (!profile) throw new DomainError("User profile not found", "UNAUTHORIZED");

    const authzRepo = serviceClient ? new UserRepository(serviceClient) : repo;
    const [permissions, branches] = await Promise.all([
      authzRepo.listPermissionKeys(profile.id),
      authzRepo.listBranchIds(profile.id),
    ]);

    return {
      accessToken,
      user: profile,
      permissions,
      branches,
    };
  }

  async getOwnProfileExtras(
    accessToken: string,
    profile: UserProfile,
    activeBranchId?: string | null,
  ) {
    const userClient = createUserClient(accessToken);
    const repo = new UserRepository(userClient);
    const serviceClient = createServiceClient();
    const authzRepo = serviceClient ? new UserRepository(serviceClient) : repo;
    const branchId = activeBranchId ?? profile.defaultBranchId;
    const [roleNames, lastLoginAt, branchName] = await Promise.all([
      authzRepo.listRoleNames(profile.id).catch(() => [] as string[]),
      authzRepo.getLastSuccessfulLoginAt(profile.organizationId, profile.email).catch(() => null),
      authzRepo.getBranchName(branchId).catch(() => null),
    ]);
    return { roleNames, lastLoginAt, branchName };
  }

  async updateOwnProfile(accessToken: string, profile: UserProfile, input: UpdateOwnProfileInput) {
    if (!supabaseConfigured()) {
      throw new DomainError("Supabase is not configured", "UNAUTHORIZED");
    }
    const userClient = createUserClient(accessToken);
    const repo = new UserRepository(userClient);
    return repo.updateOwnProfile(profile.id, input);
  }

  async changePassword(accessToken: string, profile: UserProfile, input: ChangePasswordInput) {
    if (!supabaseConfigured()) {
      throw new DomainError("Supabase is not configured", "UNAUTHORIZED");
    }

    let policy = DEFAULT_PASSWORD_POLICY;
    const infra = this.infraRepo();
    if (infra) {
      try {
        const settings = await infra.getSecuritySettings(profile.organizationId);
        policy = settings.password_policy ?? DEFAULT_PASSWORD_POLICY;
      } catch {
        /* use default */
      }
    }
    const check = validatePasswordAgainstPolicy(input.newPassword, policy);
    if (!check.ok) {
      throw new DomainError(check.errors.join("; "), "VALIDATION_ERROR");
    }

    const anon = createAnonClient();
    const verify = await anon.auth.signInWithPassword({
      email: profile.email,
      password: input.currentPassword,
    });
    if (verify.error || !verify.data.session) {
      throw new DomainError("Current password is incorrect", "UNAUTHORIZED");
    }

    const userClient = createUserClient(accessToken);
    const { error } = await userClient.auth.updateUser({ password: input.newPassword });
    if (error) throw new DomainError(error.message, "VALIDATION_ERROR");

    // Invalidate the temporary verify session
    try {
      await createUserClient(verify.data.session.access_token).auth.signOut();
    } catch {
      /* ignore */
    }
  }
}
