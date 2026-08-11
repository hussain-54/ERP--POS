import type { NextFunction, Request, Response } from "express";
import type { AuthorizationContext, UserProfile } from "@electronic-erp/contracts";
import { UserRepository } from "@electronic-erp/db";
import { createUserClient } from "../lib/supabase.js";
import { supabaseConfigured } from "../config.js";

export type AuthedRequest = Request & {
  accessToken?: string;
  profile?: UserProfile;
  authz?: AuthorizationContext;
};

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!supabaseConfigured()) {
      res.status(503).json({
        error: "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.",
      });
      return;
    }

    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }

    const accessToken = header.slice("Bearer ".length).trim();
    const client = createUserClient(accessToken);
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }

    const users = new UserRepository(client);
    const profile = await users.findByAuthUserId(data.user.id);
    if (!profile || !profile.isActive) {
      res.status(403).json({ error: "User profile missing or inactive" });
      return;
    }

    const [permissions, branchIds] = await Promise.all([
      users.listPermissionKeys(profile.id),
      users.listBranchIds(profile.id),
    ]);

    req.accessToken = accessToken;
    req.profile = profile;
    req.authz = {
      userId: profile.id,
      organizationId: profile.organizationId,
      branchId: profile.defaultBranchId ?? branchIds[0] ?? null,
      permissions,
      branchIds,
    };
    next();
  } catch (err) {
    next(err);
  }
}
