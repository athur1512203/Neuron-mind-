import { Router } from "express";
import {
  createSubject,
  deleteSubject,
  getGraph,
  getSubject,
  listSubjects,
  updateSubject,
} from "../controllers/subject.controller";
import { createConnection, listConnections } from "../controllers/connection.controller";
import { createNeuron, listNeurons } from "../controllers/neuron.controller";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";
import {
  createConnectionSchema,
  createNeuronSchema,
  createSubjectSchema,
  updateSubjectSchema,
  validateBody,
} from "../utils/validation";

export const subjectRouter = Router();

subjectRouter.use(requireAuth);
subjectRouter.get("/", asyncHandler(listSubjects));
subjectRouter.post("/", validateBody(createSubjectSchema), asyncHandler(createSubject));
subjectRouter.get("/:subjectId/graph", asyncHandler(getGraph));
subjectRouter.get("/:subjectId/neurons", asyncHandler(listNeurons));
subjectRouter.post("/:subjectId/neurons", validateBody(createNeuronSchema), asyncHandler(createNeuron));
subjectRouter.get("/:subjectId/connections", asyncHandler(listConnections));
subjectRouter.post(
  "/:subjectId/connections",
  validateBody(createConnectionSchema),
  asyncHandler(createConnection),
);
subjectRouter.get("/:id", asyncHandler(getSubject));
subjectRouter.patch("/:id", validateBody(updateSubjectSchema), asyncHandler(updateSubject));
subjectRouter.delete("/:id", asyncHandler(deleteSubject));
