import { createHash, randomUUID } from "node:crypto";
import type { Document } from "@prisma/client";
import type { Express } from "express";
import { prisma } from "../lib/prisma";
import { getStorageProvider, getStorageProviderName } from "../storage";
import { StorageObjectNotFoundError } from "../storage/StorageProvider";
import { requireOwnedDocument, requireOwnedNeuron } from "./ownership";
import { sanitizeOriginalName, validateDocumentContent } from "./document-storage";
import { AppError } from "../utils/app-error";

export function documentMetadata(document: Document) {
  const { storagePath, storageKey, storageProvider, checksum, ...metadata } = document;
  return metadata;
}

export const documentService = {
  async upload(neuronId: string, userId: string, file?: Express.Multer.File) {
    const neuron = await requireOwnedNeuron(neuronId, userId);
    if (!file) throw new AppError(400, "FILE_REQUIRED", "Vui lòng chọn tài liệu để tải lên");
    const extension = validateDocumentContent(file);
    const storedName = `${randomUUID()}${extension}`;
    const storageKey = `users/${encodeURIComponent(userId)}/workspaces/${encodeURIComponent(neuron.subjectId)}/documents/${storedName}`;
    const storageProvider = getStorageProviderName();
    const provider = getStorageProvider(storageProvider);
    await provider.upload({ key: storageKey, buffer: file.buffer, contentType: file.mimetype });
    try {
      return await prisma.document.create({ data: {
        neuronId: neuron.id, originalName: sanitizeOriginalName(file.originalname), storedName,
        mimeType: file.mimetype, extension, size: file.size,
        storageProvider, storageKey, storagePath: storageKey,
        checksum: createHash("sha256").update(file.buffer).digest("hex"),
      } });
    } catch (error) {
      try { await provider.delete(storageKey); }
      catch { console.error("Document upload rollback failed", { storageProvider, storageKey }); }
      throw error;
    }
  },
  async list(neuronId: string, userId: string) {
    await requireOwnedNeuron(neuronId, userId);
    return prisma.document.findMany({ where: { neuronId }, orderBy: { createdAt: "desc" } });
  },
  async download(documentId: string, userId: string) {
    const document = await requireOwnedDocument(documentId, userId);
    try {
      const stream = await getStorageProvider(document.storageProvider).getStream(document.storageKey);
      return { document, stream };
    } catch (error) {
      if (error instanceof StorageObjectNotFoundError) throw new AppError(404, "DOCUMENT_FILE_NOT_FOUND", "Document file not found");
      throw error;
    }
  },
  async delete(documentId: string, userId: string) {
    const document = await requireOwnedDocument(documentId, userId);
    await this.deleteObject(document);
    await prisma.document.delete({ where: { id: document.id } });
  },
  async deleteObject(document: Pick<Document, "storageProvider" | "storageKey">) {
    await getStorageProvider(document.storageProvider).delete(document.storageKey);
  },
};
