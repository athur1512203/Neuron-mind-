import { Router } from "express";
import { getMarkdownNote, upsertMarkdownNote } from "../controllers/markdown-note.controller";
import { deleteNeuron, getNeuron, updateNeuron } from "../controllers/neuron.controller";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";
import { updateNeuronSchema, upsertMarkdownNoteSchema, validateBody } from "../utils/validation";

export const neuronRouter = Router();

neuronRouter.use(requireAuth);
neuronRouter.get("/:neuronId/note", asyncHandler(getMarkdownNote));
neuronRouter.put("/:neuronId/note", validateBody(upsertMarkdownNoteSchema), asyncHandler(upsertMarkdownNote));
neuronRouter.get("/:id", asyncHandler(getNeuron));
neuronRouter.patch("/:id", validateBody(updateNeuronSchema), asyncHandler(updateNeuron));
neuronRouter.delete("/:id", asyncHandler(deleteNeuron));
