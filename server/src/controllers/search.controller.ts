import type { Request, Response } from "express";
import { searchCore } from "../search/core";

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
