import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { pool } from "../db.js";
import { unauthorized } from "../errors.js";

export const AUTH_COOKIE = "taskflow_token";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

interface TokenPayload {
  sub: string;
  ver: number;
}

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.[AUTH_COOKIE];
}

/**
 * Verifies the token and re-checks it against the user's current token_version,
 * so a logout (which bumps the version) invalidates every token issued before it.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) throw unauthorized();

    let payload: TokenPayload;
    try {
      payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }) as unknown as TokenPayload;
    } catch {
      throw unauthorized("Invalid or expired session");
    }

    const { rows } = await pool.query<AuthUser & { token_version: number }>(
      "SELECT id, email, name, token_version FROM users WHERE id = $1",
      [payload.sub],
    );
    const user = rows[0];
    if (!user || user.token_version !== payload.ver) throw unauthorized("Invalid or expired session");

    req.user = { id: user.id, email: user.email, name: user.name };
    next();
  } catch (err) {
    next(err);
  }
}

/** Returns the authenticated user; only call from handlers behind requireAuth. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
