import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { DomainError } from "@electronic-erp/domain";
import { log } from "../lib/logger.js";

function domainStatus(code: string): number {
  switch (code) {
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "UNAUTHORIZED":
      return 401;
    default:
      return 400;
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = (req.headers["x-request-id"] as string | undefined) ?? undefined;

  if (err instanceof ZodError) {
    log.warn({
      category: "api",
      message: "Validation failed",
      requestId,
      meta: { path: req.path, issues: err.issues.length },
    });
    res.status(400).json({
      error: "Validation failed",
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof DomainError) {
    const status = domainStatus(err.code);
    log.warn({
      category: "api",
      message: err.message,
      requestId,
      meta: { path: req.path, code: err.code, status },
    });
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }

  log.error({
    category: "application",
    message: "Unhandled API error",
    requestId,
    err,
    meta: { path: req.path, method: req.method },
  });
  const message =
    err instanceof Error && err.message
      ? err.message
      : "Internal server error";
  res.status(500).json({ error: message });
}
