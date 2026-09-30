import type { Request, Response } from "express";
import { searchCore } from "../search/core";
import type { SearchPlan } from "../search/types";

const HIDDEN = new Set([
  "checksum", "storagekey", "storedname", "storagepath", "passwordhash", "password",
  "secret", "credential", "bucket", "accesskey", "searchtext", "database_url",
]);

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (HIDDEN.has(key.toLowerCase())) continue;
      out[key] = sanitize(nested);
    }
    return out;
  }
  return value;
}

export async function searchGlobal(request: Request, response: Response) {
  const query = String(request.query.q ?? "").trim();
  const parsed = Number(request.query.limit);
  const limit = !Number.isFinite(parsed) || parsed <= 0 ? 20 : Math.min(50, Math.max(1, Math.floor(parsed)));
  if (!query) { response.json({ query, limit, results: [] }); return; }
  const information = await searchCore.execute({ userId: request.userId,
    requests: [{ id: "global", query }], options: { ranking: "navigation", maxResultsPerRequest: limit } });
  response.json({ query, limit, results: information.requests[0].results.map((item) => ({
    id: item.sourceId, type: item.sourceType.toLowerCase(), title: item.title, snippet: item.snippet,
    neuronId: item.neuronId, subjectId: item.subjectId, subjectName: item.subjectName, updatedAt: item.metadata.updatedAt,
  })) });
}

export async function searchDebug(request: Request, response: Response) {
  const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? request.body as Record<string, unknown>
    : {};
  const space = body.space && typeof body.space === "object" && !Array.isArray(body.space)
    ? body.space as SearchPlan["space"] : undefined;
  const neuron = body.neuron && typeof body.neuron === "object" && !Array.isArray(body.neuron)
    ? body.neuron as SearchPlan["neuron"] : undefined;
  const requests = Array.isArray(body.requests) ? body.requests as SearchPlan["requests"] : [];
  const options = body.options && typeof body.options === "object" && !Array.isArray(body.options)
    ? body.options as SearchPlan["options"] : undefined;
  const information = await searchCore.execute({
    userId: request.userId,
    space,
    neuron,
    requests,
    options,
  });
  response.json(sanitize(information));
}
