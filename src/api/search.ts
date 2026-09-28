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
