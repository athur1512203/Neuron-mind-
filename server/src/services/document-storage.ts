import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Express } from "express";
import { AppError } from "../utils/app-error";

export const DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;

const uploadRoot = path.resolve(process.cwd(), "uploads", "documents");

const allowedMimeTypesByExtension: Record<string, Set<string>> = {
  ".pdf": new Set(["application/pdf"]),
  ".doc": new Set(["application/msword"]),
  ".docx": new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
  ".ppt": new Set(["application/vnd.ms-powerpoint"]),
  ".pptx": new Set(["application/vnd.openxmlformats-officedocument.presentationml.presentation"]),
  ".xls": new Set(["application/vnd.ms-excel"]),
  ".xlsx": new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]),
  ".txt": new Set(["text/plain"]),
  ".md": new Set(["text/markdown", "text/x-markdown", "text/plain"]),
};

export const allowedDocumentExtensions = new Set(Object.keys(allowedMimeTypesByExtension));

export function getDocumentExtension(originalName: string) {
  return path.extname(originalName).toLowerCase();
}

export function sanitizeOriginalName(originalName: string) {
  const baseName = path.basename(originalName).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return baseName || "document";
}

export function validateDocumentFile(file: Pick<Express.Multer.File, "originalname" | "mimetype" | "size">) {
  const extension = getDocumentExtension(file.originalname);
  const allowedMimeTypes = allowedMimeTypesByExtension[extension];

  if (!allowedMimeTypes || !allowedMimeTypes.has(file.mimetype)) {
    throw new AppError(400, "INVALID_FILE_TYPE", "Định dạng tài liệu không được hỗ trợ");
  }

  if (file.size > DOCUMENT_MAX_BYTES) {
    throw new AppError(413, "FILE_TOO_LARGE", "Tài liệu vượt quá giới hạn 50MB");
  }

  return extension;
}

function resolveStoragePath(storagePath: string) {
  const resolved = path.resolve(uploadRoot, path.basename(storagePath));
  if (!resolved.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new AppError(400, "INVALID_STORAGE_PATH", "Invalid storage path");
  }
  return resolved;
}

export const documentStorageService = {
  async save(file: Express.Multer.File) {
    const extension = validateDocumentFile(file);
    const storedName = `${randomUUID()}${extension}`;
    const storagePath = storedName;
    const targetPath = resolveStoragePath(storagePath);

    await fs.mkdir(uploadRoot, { recursive: true });
    await fs.writeFile(targetPath, file.buffer);

    return {
      originalName: sanitizeOriginalName(file.originalname),
      storedName,
      mimeType: file.mimetype,
      extension,
      size: file.size,
      storagePath,
    };
  },

  async get(storagePath: string) {
    const filePath = resolveStoragePath(storagePath);
    await fs.access(filePath);
    return filePath;
  },

  async delete(storagePath: string) {
    const filePath = resolveStoragePath(storagePath);
    await fs.rm(filePath, { force: true });
  },
};
