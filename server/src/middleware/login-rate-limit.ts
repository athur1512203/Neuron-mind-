import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function loginRateLimit(request: { ip?: string }, _response: unknown, next: (error?: unknown) => void): void {
  const windowMs = readPositiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  const max = readPositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 20);
  const ip = typeof request.ip === "string" && request.ip.trim() ? request.ip.trim() : "unknown";
  const key = `login:${ip}`;
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }
  if (current.count >= max) {
    next(new AppError(429, "RATE_LIMIT_EXCEEDED", "Too many login attempts. Try again later."));
    return;
  }
  current.count += 1;
  next();
}

export const loginRateLimitMiddleware: RequestHandler = (request, _response, next) => {
  loginRateLimit(request, _response, next);
};
