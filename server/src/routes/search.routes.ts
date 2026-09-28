import { Router } from "express";
import { searchGlobal } from "../controllers/search.controller";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";

export const searchRouter = Router();

searchRouter.use(requireAuth);
searchRouter.get("/", asyncHandler(searchGlobal));
