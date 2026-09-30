import { apiRequest } from "./client";

export type SearchResultType = "neuron" | "markdown" | "document";

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  snippet?: string;
  neuronId?: string;
  subjectId?: string;
  subjectName?: string;
  updatedAt?: string;
};

export type GlobalSearchResponse = {
  query: string;
  limit: number;
  results: SearchResult[];
};

export function searchGlobal(query: string, options: { signal?: AbortSignal; limit?: number } = {}) {
  const params = new URLSearchParams({ q: query });
  if (options.limit) params.set("limit", String(options.limit));
  return apiRequest<GlobalSearchResponse>(`/search?${params.toString()}`, { signal: options.signal });
}

export type SearchSourceType = "NEURON" | "MARKDOWN" | "DOCUMENT";

export type SearchDebugRequest = {
  space?: { id?: string; query?: string };
  neuron?: { id?: string; query?: string };
  requests: Array<{ id: string; query: string; sources?: SearchSourceType[] }>;
  options?: { ranking?: "context" | "navigation"; maxResultsPerRequest?: number };
};

export type RetrievedDebugItem = {
  id: string;
  sourceType: SearchSourceType;
  sourceId: string;
  subjectId: string;
  neuronId: string;
  title: string;
  heading: string;
  content: string;
  score: number;
  provenance: { sourceType: SearchSourceType; sourceId: string; subjectId: string; neuronId: string };
  metadata: { updatedAt: string; fileName?: string; mimeType?: string; fileSize?: number };
  subjectName?: string;
  snippet?: string;
};

export type RetrievedInformation = {
  plan: { resolvedSpaceIds: string[]; resolvedNeuronIds: string[] };
  requests: { requestId: string; query: string; found: boolean; results: RetrievedDebugItem[] }[];
  sources: Array<Omit<RetrievedDebugItem, "id" | "content" | "heading" | "score" | "snippet">>;
};

export function debugSearchCore(body: SearchDebugRequest) {
  return apiRequest<RetrievedInformation>("/search/debug", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
