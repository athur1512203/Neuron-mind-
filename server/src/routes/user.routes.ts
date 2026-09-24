import { Router } from "express";
import { me } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";

export const userRouter = Router();

userRouter.get("/me", requireAuth, asyncHandler(me));
