import { apiRequest } from "./client";
import { mapConnection, type ApiConnection } from "./mappers";

export async function createConnection(subjectId: string, sourceNeuronId: string, targetNeuronId: string) {
  const connection = await apiRequest<ApiConnection>(`/subjects/${subjectId}/connections`, {
    method: "POST",
    body: JSON.stringify({ sourceNeuronId, targetNeuronId }),
  });
  return mapConnection(connection);
}

export async function deleteConnection(id: string) {
  await apiRequest<void>(`/connections/${id}`, { method: "DELETE" });
}
