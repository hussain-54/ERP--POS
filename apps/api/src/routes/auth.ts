import { Router } from "express";
import {
  LoginSchema,
  PasswordResetRequestSchema,
} from "@electronic-erp/contracts";
import { AuthService } from "../services/auth-service.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const authRouter = Router();
const authService = new AuthService();

authRouter.post("/login", async (req, res, next) => {
  try {
    const input = LoginSchema.parse(req.body);
    const session = await authService.login(input, {
      ipAddress: String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? ""),
      userAgent: String(req.headers["user-agent"] ?? ""),
    });
    res.json(session);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await authService.logout(req.accessToken!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  res.json({
    user: req.profile,
    permissions: req.authz?.permissions ?? [],
    branches: req.authz?.branchIds ?? [],
    organizationId: req.authz?.organizationId,
    branchId: req.authz?.branchId,
  });
});

authRouter.post("/password-reset", async (req, res, next) => {
  try {
    const input = PasswordResetRequestSchema.parse(req.body);
    await authService.requestPasswordReset(input);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/session", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const session = await authService.restoreSession(req.accessToken!);
    res.json(session);
  } catch (err) {
    next(err);
  }
});
