import {
  LoginSchema,
  PasswordResetRequestSchema,
  type LoginInput,
  type PasswordResetRequestInput,
} from "@electronic-erp/contracts";
import { InfrastructureRepository, UserRepository } from "@electronic-erp/db";
import { DEFAULT_PASSWORD_POLICY } from "@electronic-erp/domain";
import {
  createAnonClient,
  createServiceClient,
  createUserClient,
} from "../lib/supabase.js";
import { supabaseConfigured } from "../config.js";

export class AuthService {
  private infraRepo() {
    const svc = createServiceClient();
    return svc ? new InfrastructureRepository(svc) : null;
  }

  async login(
    raw: LoginInput,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const input = LoginSchema.parse(raw);
    if (!supabaseConfigured()) {
      throw new Error("Supabase is not configured");
    }

    const infra = this.infraRepo();
    if (infra) {
      const orgHint = await infra.findOrgIdByEmail(input.email);
      if (orgHint) {
        const settings = await infra.getSecuritySettings(orgHint);
        await infra.assertNotLocked(orgHint, input.email, settings.password_policy);
      }
    }

    const client = createAnonClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.session || !data.user) {
      if (infra) {
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
      }
      throw new Error(error?.message ?? "Login failed");
    }

    const userClient = createUserClient(data.session.access_token);
    const repo = new UserRepository(userClient);
    const serviceClient = createServiceClient();
    let profile = await repo.findByAuthUserId(data.user.id);
    // Fallback: service role bypasses RLS if helpers are not yet SECURITY DEFINER
    if (!profile && serviceClient) {
      profile = await new UserRepository(serviceClient).findByAuthUserId(data.user.id);
    }
    if (!profile) {
      if (infra) {
        await infra.recordLoginAttempt({
          email: input.email,
          success: false,
          failureReason: "User profile not found",
        });
      }
      throw new Error("User profile not found. Complete onboarding / seed profile.");
    }

    const orgId = String(profile.organizationId);
    const settings = infra ? await infra.getSecuritySettings(orgId) : null;
    const policy = settings?.password_policy ?? DEFAULT_PASSWORD_POLICY;

    if (infra) {
      try {
        await infra.assertNotLocked(orgId, input.email, policy);
      } catch (lockErr) {
        await client.auth.signOut();
        throw lockErr;
      }
    }

    if (policy.twoFactorEnforced && infra) {
      const { data: tfa } = await userClient
        .from("user_two_factor")
        .select("enabled")
        .eq("user_id", profile.id)
        .maybeSingle();
      if (!tfa?.enabled) {
        await infra.logActivity({
          organizationId: orgId,
          userId: profile.id,
          action: "security.2fa_enforcement_pending",
          detail: { note: "2FA enforced in policy but user not enrolled" },
        });
      }
    }

    // Prefer service client for permission/branch reads when available (RLS-safe bootstrap)
    const authzRepo = serviceClient ? new UserRepository(serviceClient) : repo;
    const [permissions, branches] = await Promise.all([
      authzRepo.listPermissionKeys(profile.id),
      authzRepo.listBranchIds(profile.id),
    ]);

    if (infra) {
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
      throw new Error("Supabase is not configured");
    }
    const client = createAnonClient();
    const redirectTo = `${process.env.API_CORS_ORIGIN ?? "http://localhost:5173"}/auth/reset`;
    const { error } = await client.auth.resetPasswordForEmail(input.email, {
      redirectTo,
    });
    if (error) throw new Error(error.message);
  }

  async restoreSession(accessToken: string) {
    if (!supabaseConfigured()) {
      throw new Error("Supabase is not configured");
    }
    const userClient = createUserClient(accessToken);
    const { data, error } = await userClient.auth.getUser();
    if (error || !data.user) {
      throw new Error("Invalid session");
    }

    const repo = new UserRepository(userClient);
    const profile = await repo.findByAuthUserId(data.user.id);
    if (!profile) throw new Error("User profile not found");

    const [permissions, branches] = await Promise.all([
      repo.listPermissionKeys(profile.id),
      repo.listBranchIds(profile.id),
    ]);

    return {
      accessToken,
      user: profile,
      permissions,
      branches,
    };
  }
}
