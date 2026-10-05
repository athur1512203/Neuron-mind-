import { Router } from "express";
import { z } from "zod";
import { aiManager } from "../ai/manager";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";

const bodySchema = z.strictObject({ message: z.string().trim().min(1).max(8000) });
export const aiRouter = Router();
aiRouter.post("/chat", requireAuth, asyncHandler(async (request, response) => {
  const { message } = bodySchema.parse(request.body);
  response.json(await aiManager.chat(request.userId, message));
}));
