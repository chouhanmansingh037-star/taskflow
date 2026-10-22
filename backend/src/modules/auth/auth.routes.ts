import { Router, type Response } from "express";
import { z } from "zod";
import { config } from "../../config.js";
import { AUTH_COOKIE, currentUser, requireAuth } from "../../middleware/auth.js";
import { parse, trimmedString } from "../../validation.js";
import { loginUser, registerUser, revokeSessions } from "./auth.service.js";

const registerSchema = z.object({
  name: trimmedString(80).min(1, "Name is required"),
  email: z.string().trim().toLowerCase().email("Must be a valid email").max(254),
  // bcrypt only uses the first 72 bytes, so longer passwords are rejected rather than silently truncated.
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .refine((value) => Buffer.byteLength(value) <= 72, "Password must be at most 72 bytes"),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Must be a valid email").max(254),
  password: z.string().min(1, "Password is required").max(200),
});

function setSessionCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const { user, token } = await registerUser(parse(registerSchema, req.body));
    setSessionCookie(res, token);
    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { user, token } = await loginUser(parse(loginSchema, req.body));
    setSessionCookie(res, token);
    res.json({ user, token });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await revokeSessions(currentUser(req).id);
    res.clearCookie(AUTH_COOKIE, { path: "/" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: currentUser(req) });
});
