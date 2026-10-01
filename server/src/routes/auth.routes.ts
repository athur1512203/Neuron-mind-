import { Router } from "express";
import { login, register } from "../controllers/auth.controller";
import { loginRateLimitMiddleware, registerRateLimitMiddleware } from "../middleware/rate-limit";
import { asyncHandler } from "../utils/async-handler";
import { authSchema, validateBody } from "../utils/validation";

export const authRouter = Router();

authRouter.post("/register", registerRateLimitMiddleware, validateBody(authSchema), asyncHandler(register));
authRouter.post("/login", validateBody(authSchema), loginRateLimitMiddleware, asyncHandler(login));
