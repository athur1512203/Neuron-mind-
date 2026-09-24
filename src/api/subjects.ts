import { apiRequest } from "./client";
import { mapConnection, mapNeuron, mapSubject, type ApiConnection, type ApiNeuron, type ApiSubject } from "./mappers";

export async function listSubjects() {
  const subjects = await apiRequest<ApiSubject[]>("/subjects");
  return subjects.map(mapSubject);
}

export async function createSubject(payload: { name: string; color: string }) {
  const subject = await apiRequest<ApiSubject>("/subjects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapSubject({ ...subject, neuronCount: 0, connectionCount: 0 });
}

export async function updateSubject(id: string, payload: { name?: string; color?: string }) {
  const subject = await apiRequest<ApiSubject>(`/subjects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return mapSubject(subject);
}

export async function deleteSubject(id: string) {
  await apiRequest<void>(`/subjects/${id}`, { method: "DELETE" });
}

export async function getSubjectGraph(subjectId: string) {
  const data = await apiRequest<{
    subject: ApiSubject;
    neurons: ApiNeuron[];
    connections: ApiConnection[];
  }>(`/subjects/${subjectId}/graph`);
  return {
    subject: mapSubject(data.subject),
    neurons: data.neurons.map(mapNeuron),
    connections: data.connections.map(mapConnection),
  };
}
