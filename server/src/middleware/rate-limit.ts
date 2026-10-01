import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function createIpRateLimit(options: {
  prefix: string;
  maxEnv: string;
  windowEnv: string;
  defaultMax: number;
  defaultWindowMs: number;
  message: string;
}): RequestHandler {
  return (request, _response, next) => {
    const windowMs = readPositiveInt(process.env[options.windowEnv], options.defaultWindowMs);
    const max = readPositiveInt(process.env[options.maxEnv], options.defaultMax);
    const ip = typeof request.ip === "string" && request.ip.trim() ? request.ip.trim() : "unknown";
    const key = `${options.prefix}:${ip}`;
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (current.count >= max) {
      next(new AppError(429, "RATE_LIMIT_EXCEEDED", options.message));
      return;
    }
    current.count += 1;
    next();
  };
}

export const loginRateLimitMiddleware = createIpRateLimit({
  prefix: "login",
  maxEnv: "AUTH_RATE_LIMIT_MAX",
  windowEnv: "AUTH_RATE_LIMIT_WINDOW_MS",
  defaultMax: 20,
  defaultWindowMs: 15 * 60 * 1000,
  message: "Too many login attempts. Try again later.",
});

export const registerRateLimitMiddleware = createIpRateLimit({
  prefix: "register",
  maxEnv: "REGISTER_RATE_LIMIT_MAX",
  windowEnv: "REGISTER_RATE_LIMIT_WINDOW_MS",
  defaultMax: 10,
  defaultWindowMs: 15 * 60 * 1000,
  message: "Too many registration attempts. Try again later.",
});

export const uploadRateLimitMiddleware = createIpRateLimit({
  prefix: "upload",
  maxEnv: "UPLOAD_RATE_LIMIT_MAX",
  windowEnv: "UPLOAD_RATE_LIMIT_WINDOW_MS",
  defaultMax: 30,
  defaultWindowMs: 15 * 60 * 1000,
  message: "Too many upload attempts. Try again later.",
});

/** @deprecated Use loginRateLimitMiddleware */
export const loginRateLimit = loginRateLimitMiddleware;
