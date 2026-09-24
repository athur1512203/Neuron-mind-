import { Router } from "express";
import { deleteConnection } from "../controllers/connection.controller";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";

export const connectionRouter = Router();

connectionRouter.use(requireAuth);
connectionRouter.delete("/:id", asyncHandler(deleteConnection));
