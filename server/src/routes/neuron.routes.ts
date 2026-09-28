import { Router } from "express";
import { deleteNeuron, getNeuron, updateNeuron } from "../controllers/neuron.controller";
import { requireAuth } from "../middleware/auth";
import { neuronDocumentRouter } from "./document.routes";
import { asyncHandler } from "../utils/async-handler";
import { updateNeuronSchema, validateBody } from "../utils/validation";

export const neuronRouter = Router();

neuronRouter.use(requireAuth);
neuronRouter.use("/:neuronId/documents", neuronDocumentRouter);
neuronRouter.get("/:id", asyncHandler(getNeuron));
neuronRouter.patch("/:id", validateBody(updateNeuronSchema), asyncHandler(updateNeuron));
neuronRouter.delete("/:id", asyncHandler(deleteNeuron));
