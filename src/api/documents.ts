import { ApiError, apiRequest, apiUrl, getToken } from "./client";

export type DocumentMeta = {
  id: string;
  subjectId: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  extension: string;
  size: number;
  createdAt: string;
  updatedAt: string;
};

export const DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;

const allowedExtensions = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt", ".md", ".zip"]);

function fileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

export function validateDocumentFile(file: File) {
  if (!allowedExtensions.has(fileExtension(file.name))) {
    return "Định dạng tài liệu không được hỗ trợ.";
  }

  if (file.size > DOCUMENT_MAX_BYTES) {
    return "Tài liệu vượt quá giới hạn 50MB.";
  }

  return "";
}

export async function listDocuments(subjectId: string) {
  return apiRequest<DocumentMeta[]>(`/subjects/${subjectId}/documents`);
}

export async function uploadDocument(subjectId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest<DocumentMeta>(`/subjects/${subjectId}/documents`, {
    method: "POST",
    body: formData,
  });
}

export async function deleteDocument(documentId: string) {
  await apiRequest<void>(`/documents/${documentId}`, { method: "DELETE" });
}

export async function downloadDocument(document: DocumentMeta) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(apiUrl(`/documents/${document.id}/download`), { headers });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    throw new ApiError(
      response.status,
      data.error?.code ?? "DOWNLOAD_FAILED",
      data.error?.message ?? "Không tải được tài liệu.",
    );
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = document.originalName;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
