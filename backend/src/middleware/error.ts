import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors.js";
import { logger } from "../logger.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.path} not found` } });
}

/** Single place where every failure is turned into the { error: { code, message } } shape. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }

  // Errors raised by body-parser (malformed JSON, oversized payloads).
  const parserError = err as { type?: string; status?: number };
  if (parserError?.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Request body is not valid JSON" } });
  }
  if (parserError?.type === "entity.too.large") {
    return res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large" } });
  }

  logger.error("unhandled error", {
    method: req.method,
    path: req.path,
    error: err instanceof Error ? err.stack : String(err),
  });
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
}
