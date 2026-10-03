import { pipeline } from "node:stream/promises";
import type { Request, Response } from "express";
import { documentMetadata, documentService } from "../services/document.service";
import { routeParam } from "../utils/request";

export async function uploadDocument(request: Request, response: Response) {
  const document = await documentService.upload(routeParam(request, "subjectId"), request.userId, request.file);
  response.status(201).json(documentMetadata(document));
}

export async function listDocuments(request: Request, response: Response) {
  const documents = await documentService.list(routeParam(request, "subjectId"), request.userId);
  response.json(documents.map(documentMetadata));
}

export async function deleteDocument(request: Request, response: Response) {
  await documentService.delete(routeParam(request, "documentId"), request.userId);

  response.status(204).send();
}

export async function downloadDocument(request: Request, response: Response) {
  const { document, stream } = await documentService.download(routeParam(request, "documentId"), request.userId);
  response.attachment(document.originalName);
  response.setHeader("Content-Type", document.mimeType);
  response.setHeader("Content-Length", document.size);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "private, no-store");
  await pipeline(stream, response);
}
