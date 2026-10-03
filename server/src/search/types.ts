import type { KnowledgeSource } from "../knowledge/types";

export type SearchSourceType = KnowledgeSource["type"];
export interface SearchRequest {
  id: string;
  query: string;
  sources?: SearchSourceType[];
  purpose?: string;
}
export interface SearchPlan {
  userId: string;
  space?: { id?: string; query?: string };
  neuron?: { id?: string; query?: string };
  requests: SearchRequest[];
  options?: {
    maxSpaces?: number;
    maxNeurons?: number;
    maxResultsPerRequest?: number;
    includeRelatedNeurons?: boolean;
    // Existing palette's exact-title/recency ordering, implemented inside the same core.
    ranking?: "context" | "navigation";
  };
}
export interface SearchSource extends Omit<KnowledgeSource, "neuronId" | "provenance"> {
  neuronId?: string;
  provenance: Omit<KnowledgeSource["provenance"], "neuronId"> & { neuronId?: string };
  subjectName?: string;
  metadata?: { fileName?: string; mimeType?: string; fileSize?: number };
  /** Repository-only searchable aliases; never included in output DTOs. */
  searchText?: string;
  snippetFields?: string[];
}
export interface RetrievedItem {
  id: string;
  sourceType: SearchSourceType;
  sourceId: string;
  subjectId: string;
  neuronId?: string;
  title: string;
  heading: string;
  content: string;
  score: number;
  provenance: Omit<KnowledgeSource["provenance"], "neuronId"> & { neuronId?: string };
  metadata: { updatedAt: string; fileName?: string; mimeType?: string; fileSize?: number };
  subjectName?: string;
  snippet?: string;
}
export interface RetrievedInformation {
  plan: { resolvedSpaceIds: string[]; resolvedNeuronIds: string[] };
  requests: { requestId: string; query: string; found: boolean; results: RetrievedItem[] }[];
  sources: Array<Omit<RetrievedItem, "id" | "content" | "heading" | "score" | "snippet">>;
}

export interface RetrievedChunk {
  sourceType: KnowledgeSource["type"];
  sourceId: string;
  neuronId?: string;
  subjectId: string;
  title: string;
  updatedAt: string;
  heading: string;
  content: string;
  score: number;
}

