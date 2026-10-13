import { apiRequest } from "./client";

export type MarkdownNoteResponse = {
  id?: string;
  neuronId: string;
  content: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type NeuronNote = {
  id: string;
  neuronId: string;
  name: string;
  content?: string;
  sortOrder: number;
  isDefault: number | boolean;
  createdAt: string;
  updatedAt: string;
};

export function listNeuronNotes(neuronId: string, signal?: AbortSignal) {
  return apiRequest<NeuronNote[]>(`/neurons/${neuronId}/notes`, { signal });
}

export function createNeuronNote(neuronId: string, name = "Note mới") {
  return apiRequest<NeuronNote>(`/neurons/${neuronId}/notes`, { method: "POST", body: JSON.stringify({ name }) });
}

export function reorderNeuronNotes(neuronId: string, noteIds: string[]) {
  return apiRequest<{ noteIds: string[] }>(`/neurons/${neuronId}/notes/order`, { method: "PUT", body: JSON.stringify({ noteIds }) });
}

export function getNote(noteId: string, signal?: AbortSignal) {
  return apiRequest<NeuronNote>(`/notes/${noteId}`, { signal });
}

export function saveNoteContent(noteId: string, content: string) {
  return apiRequest<NeuronNote>(`/notes/${noteId}`, { method: "PUT", body: JSON.stringify({ content }) });
}

export function updateNote(noteId: string, patch: { name?: string; sortOrder?: number }) {
  return apiRequest<NeuronNote>(`/notes/${noteId}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteNote(noteId: string) {
  return apiRequest<void>(`/notes/${noteId}`, { method: "DELETE" });
}

export async function getNeuronMarkdown(neuronId: string, signal?: AbortSignal) {
  return apiRequest<MarkdownNoteResponse>(`/neurons/${neuronId}/note`, { method: "GET", signal });
}

export async function saveNeuronMarkdown(neuronId: string, content: string) {
  return apiRequest<MarkdownNoteResponse>(`/neurons/${neuronId}/note`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}
