import { apiRequest } from "./client";

export type MarkdownNoteResponse = {
  id?: string;
  neuronId: string;
  content: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export async function getNeuronMarkdown(neuronId: string, signal?: AbortSignal) {
  return apiRequest<MarkdownNoteResponse>(`/neurons/${neuronId}/note`, { method: "GET", signal });
}

export async function saveNeuronMarkdown(neuronId: string, content: string) {
  return apiRequest<MarkdownNoteResponse>(`/neurons/${neuronId}/note`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}
