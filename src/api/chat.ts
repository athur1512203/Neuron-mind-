import { apiRequest } from "./client";

export type NeuroChatCitation = {
  type: "NEURON" | "MARKDOWN" | "DOCUMENT";
  sourceId: string;
  title: string;
  neuronId: string;
  subjectId: string;
};

export type NeuroChatResponse = {
  neuronId: string;
  subjectId: string;
  found: boolean;
  answer: string | null;
  sources: NeuroChatCitation[];
};

export type NeuroChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export function askNeuronChat(neuronId: string, message: string, history: NeuroChatTurn[] = []) {
  return apiRequest<NeuroChatResponse>(`/neurons/${neuronId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}
