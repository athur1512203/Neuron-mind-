import { AppError } from "../utils/app-error";

// DOCUMENT is reserved; no document provider or extraction is enabled in the MVP.
export type KnowledgeSourceType = "NEURON" | "MARKDOWN" | "DOCUMENT";

export interface KnowledgeProvenance {
  sourceType: KnowledgeSourceType;
  sourceId: string;
  neuronId: string;
  subjectId: string;
}

export interface KnowledgeSource {
  type: KnowledgeSourceType;
  sourceId: string;
  neuronId: string;
  subjectId: string;
  title: string;
  // null means text is unavailable; "" means a source with empty text.
  content: string | null;
  updatedAt: string;
  provenance: KnowledgeProvenance;
}

export interface KnowledgeContext {
  // The selected neuron anchors the context. Each source retains its own graph IDs,
  // allowing future related-neuron sources without changing the source contract.
  neuronId: string;
  subjectId: string;
  sources: KnowledgeSource[];
}

export interface KnowledgeScope {
  neuronId: string;
  // Server-only: must come from verified auth (request.userId), never request data.
  userId: string;
}

export interface KnowledgeSourceProvider {
  readonly type: KnowledgeSourceType;
  getSources(scope: KnowledgeScope): Promise<KnowledgeSource[]>;
}

// Fail closed even for JavaScript callers: Prisma ignores undefined filters.
export function assertKnowledgeScope(scope: KnowledgeScope): void {
  if (typeof scope?.userId !== "string" || !scope.userId.trim()) {
    throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }
  if (typeof scope.neuronId !== "string" || !scope.neuronId.trim()) {
    throw new AppError(400, "VALIDATION_ERROR", "neuronId is required");
  }
}
