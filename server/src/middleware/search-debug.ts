import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error";

export const requireSearchDebug: RequestHandler = (_request, _response, next) => {
  if (process.env.ENABLE_SEARCH_DEBUG !== "true") {
    next(new AppError(404, "ROUTE_NOT_FOUND", "Route not found"));
    return;
  }
  next();
};
