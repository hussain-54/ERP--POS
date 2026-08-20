import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { DomainError } from "@electronic-erp/domain";
import { mapSupabaseError } from "@electronic-erp/db";
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

function formatZodError(err: ZodError): string {
  const issues = err.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "form";
    return `${path}: ${issue.message}`;
  });
  return issues.length ? issues.join("; ") : "Validation failed";
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
    const message = formatZodError(err);
    log.warn({
      category: "api",
      message: "Validation failed",
      requestId,
      meta: { path: req.path, issues: err.issues.length },
    });
    res.status(400).json({
      error: message,
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

  const mapped = mapSupabaseError(err);
  if (mapped instanceof DomainError) {
    const status = domainStatus(mapped.code);
    log.warn({
      category: "api",
      message: mapped.message,
      requestId,
      meta: { path: req.path, code: mapped.code, status },
    });
    res.status(status).json({ error: mapped.message, code: mapped.code });
    return;
  }

  log.error({
    category: "application",
    message: "Unhandled API error",
    requestId,
    err,
    meta: { path: req.path, method: req.method },
  });
  const message = extractErrorMessage(mapped);
  res.status(500).json({ error: message });
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Internal server error";
}
