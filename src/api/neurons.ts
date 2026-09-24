import { apiRequest } from "./client";
import { mapNeuron, type ApiNeuron } from "./mappers";

export type CreateNeuronPayload = {
  name: string;
  color: string;
  textContent?: string;
  keyPoints?: string;
  memoryMethod?: string;
  application?: string;
  positionX?: number;
  positionY?: number;
  positionZ?: number;
};

export type UpdateNeuronPayload = {
  name?: string;
  color?: string;
  textContent?: string;
  keyPoints?: string;
  memoryMethod?: string;
  application?: string;
  positionX?: number;
  positionY?: number;
  positionZ?: number;
};

export async function createNeuron(subjectId: string, payload: CreateNeuronPayload) {
  const neuron = await apiRequest<ApiNeuron>(`/subjects/${subjectId}/neurons`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapNeuron(neuron);
}

export async function updateNeuron(id: string, payload: UpdateNeuronPayload) {
  const neuron = await apiRequest<ApiNeuron>(`/neurons/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return mapNeuron(neuron);
}

export async function deleteNeuron(id: string) {
  await apiRequest<void>(`/neurons/${id}`, { method: "DELETE" });
}
