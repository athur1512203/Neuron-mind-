import type { Request } from "express";
import { AppError } from "./app-error";

export function routeParam(request: Request, name: string) {
  const value = request.params[name];
  if (typeof value !== "string" || !value) {
    throw new AppError(400, "INVALID_ROUTE_PARAMETER", `Invalid ${name}`);
  }
  return value;
}
