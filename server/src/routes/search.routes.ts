import { Router } from "express";
import { searchDebug, searchGlobal } from "../controllers/search.controller";
import { requireAuth } from "../middleware/auth";
import { requireSearchDebug } from "../middleware/search-debug";
import { asyncHandler } from "../utils/async-handler";

export const searchRouter = Router();

searchRouter.get("/", requireAuth, asyncHandler(searchGlobal));
searchRouter.post("/debug", requireSearchDebug, requireAuth, asyncHandler(searchDebug));
