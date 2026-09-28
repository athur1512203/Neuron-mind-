import path from "node:path";
import type { Express } from "express";
import { AppError } from "../utils/app-error";

export const DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;


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
  const baseName = path.posix.basename(originalName.replace(/\\/g, "/")).replace(/[\u0000-\u001f\u007f]/g, "").trim();
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

export function validateDocumentContent(file: Express.Multer.File) {
  const extension = validateDocumentFile(file);
  const buffer = file.buffer;
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length !== file.size) {
    throw new AppError(400, "INVALID_FILE", "File is empty or malformed");
  }
  const starts = (hex: string) => buffer.subarray(0, hex.length / 2).equals(Buffer.from(hex, "hex"));
  const valid = extension === ".pdf" ? buffer.subarray(0, 5).toString() === "%PDF-"
    : [".doc", ".ppt", ".xls"].includes(extension) ? starts("d0cf11e0a1b11e1")
    : [".docx", ".pptx", ".xlsx"].includes(extension) ? starts("504b0304")
    : !buffer.includes(0) && !starts("4d5a") && !starts("7f454c46");
  if (!valid) throw new AppError(400, "INVALID_FILE_CONTENT", "File content does not match the document format");
  return extension;
}
