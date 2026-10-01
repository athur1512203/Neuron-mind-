import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { JWT_VERIFY_OPTIONS } from "../config/secrets";
import { AppError } from "../utils/app-error";

type TokenPayload = jwt.JwtPayload & { sub: string };

export const requireAuth: RequestHandler = (request, _response, next) => {
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    next(new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required"));
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    next(new AppError(500, "SERVER_CONFIGURATION_ERROR", "Server is not configured"));
    return;
  }

  try {
    const payload = jwt.verify(authorization.slice(7), secret, JWT_VERIFY_OPTIONS) as TokenPayload;
    if (!payload.sub) throw new Error("Missing subject");
    request.userId = payload.sub;
    next();
  } catch {
    next(new AppError(401, "INVALID_TOKEN", "Invalid or expired token"));
  }
};
