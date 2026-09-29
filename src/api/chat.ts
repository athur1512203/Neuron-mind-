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
  sources?: NeuroChatCitation[];
};

export const NEURO_CHAT_NOT_FOUND =
  "Không tìm thấy thông tin liên quan trong kiến thức của neuron này.";

export const NEURO_CHAT_NETWORK_ERROR = "Không thể kết nối với Neuro. Vui lòng thử lại.";

export function neuroChatAssistantFromResponse(result: NeuroChatResponse): {
  content: string;
  sources: NeuroChatCitation[];
} {
  if (result.found === false || result.answer == null || !result.answer.trim()) {
    return { content: NEURO_CHAT_NOT_FOUND, sources: [] };
  }
  return { content: result.answer, sources: result.found === true ? result.sources : [] };
}

export function askNeuronChat(neuronId: string, message: string, history: NeuroChatTurn[] = []) {
  return apiRequest<NeuroChatResponse>(`/neurons/${neuronId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}
