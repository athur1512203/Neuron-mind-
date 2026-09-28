import type { Document } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireOwnedDocument, requireOwnedNeuron } from "../services/ownership";
import { documentStorageService } from "../services/document-storage";
import { AppError } from "../utils/app-error";
import { routeParam } from "../utils/request";

function serializeDocument(document: Document) {
  const { storagePath: _storagePath, ...metadata } = document;
  return metadata;
}

export async function uploadDocument(request: Request, response: Response) {
  const neuron = await requireOwnedNeuron(routeParam(request, "neuronId"), request.userId);
  const file = request.file;

  if (!file) {
    throw new AppError(400, "FILE_REQUIRED", "Vui lòng chọn tài liệu để tải lên");
  }

  const stored = await documentStorageService.save(file);

  try {
    const document = await prisma.document.create({
      data: {
        neuronId: neuron.id,
        ...stored,
      },
    });

    response.status(201).json(serializeDocument(document));
  } catch (error) {
    await documentStorageService.delete(stored.storagePath);
    throw error;
  }
}

export async function listDocuments(request: Request, response: Response) {
  const neuron = await requireOwnedNeuron(routeParam(request, "neuronId"), request.userId);
  const documents = await prisma.document.findMany({
    where: { neuronId: neuron.id },
    orderBy: { createdAt: "desc" },
  });

  response.json(documents.map(serializeDocument));
}

export async function deleteDocument(request: Request, response: Response) {
  const document = await requireOwnedDocument(routeParam(request, "documentId"), request.userId);

  await prisma.document.delete({ where: { id: document.id } });
  await documentStorageService.delete(document.storagePath);

  response.status(204).send();
}

export async function downloadDocument(request: Request, response: Response, next: NextFunction) {
  const document = await requireOwnedDocument(routeParam(request, "documentId"), request.userId);
  const filePath = await documentStorageService.get(document.storagePath);

  response.setHeader("Content-Type", document.mimeType);
  response.download(filePath, document.originalName, (error) => {
    if (error) next(error);
  });
}
