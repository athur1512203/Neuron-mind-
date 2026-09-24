import { Router } from "express";
import { login, register } from "../controllers/auth.controller";
import { asyncHandler } from "../utils/async-handler";
import { authSchema, validateBody } from "../utils/validation";

export const authRouter = Router();

authRouter.post("/register", validateBody(authSchema), asyncHandler(register));
authRouter.post("/login", validateBody(authSchema), asyncHandler(login));
