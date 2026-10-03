import { Router } from "express";
import multer from "multer";
import {
  deleteDocument,
  downloadDocument,
  listDocuments,
  uploadDocument,
} from "../controllers/document.controller";
import { requireAuth } from "../middleware/auth";
import { uploadRateLimitMiddleware } from "../middleware/rate-limit";
import { DOCUMENT_MAX_BYTES, validateDocumentFile } from "../services/document-storage";
import { asyncHandler } from "../utils/async-handler";
import { requireOwnedSubject } from "../services/ownership";
import { routeParam } from "../utils/request";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_MAX_BYTES, files: 1 },
  fileFilter: (_request, file, callback) => {
    try {
      validateDocumentFile({ originalname: file.originalname, mimetype: file.mimetype, size: 0 });
      callback(null, true);
    } catch (error) {
      callback(error as Error);
    }
  },
});

export const subjectDocumentRouter = Router({ mergeParams: true });
export const documentRouter = Router();

subjectDocumentRouter.use(requireAuth);
subjectDocumentRouter.get("/", asyncHandler(listDocuments));
subjectDocumentRouter.post("/", uploadRateLimitMiddleware, asyncHandler(async (request, _response, next) => {
  await requireOwnedSubject(routeParam(request, "subjectId"), request.userId);
  next();
}), upload.single("file"), asyncHandler(uploadDocument));

documentRouter.use(requireAuth);
documentRouter.get("/:documentId/download", asyncHandler(downloadDocument));
documentRouter.delete("/:documentId", asyncHandler(deleteDocument));
