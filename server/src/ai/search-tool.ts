import { z } from "zod";
import type { FunctionTool } from "openai/resources/responses/responses";
import type { RetrievedInformation, SearchPlan } from "../search/types";

const scope = z.strictObject({ id: z.string().trim().min(1).max(200).optional(), query: z.string().trim().min(1).max(500).optional() });
export const searchArguments = z.strictObject({
  space: scope.optional(), neuron: scope.optional(),
  requests: z.array(z.strictObject({
    id: z.string().trim().min(1).max(100), query: z.string().trim().min(1).max(1000),
    sources: z.array(z.enum(["NEURON", "MARKDOWN"])).min(1).max(2).optional(),
  })).max(3),
  options: z.strictObject({
    maxSpaces: z.number().int().min(1).max(3).optional(),
    maxNeurons: z.number().int().min(1).max(10).optional(),
    maxResultsPerRequest: z.number().int().min(1).max(10).optional(),
    ranking: z.enum(["context", "navigation"]).optional(),
  }).optional(),
});

export const searchMemoryTool: FunctionTool = {
  type: "function", name: "search_memory",
  description: "Read owned structured memory. Resolve Space then Neuron with requests: []; reuse returned IDs for content queries. Sources are NEURON and MARKDOWN only.",
  // Optional properties retain the existing SearchPlan shape; server validation is mandatory.
  strict: false, parameters: z.toJSONSchema(searchArguments),
};

export function toSearchPlan(input: unknown, userId: string): SearchPlan {
  const args = searchArguments.parse(input);
  return { ...args, userId,
    requests: args.requests.map((request) => ({ ...request, sources: request.sources ?? ["NEURON", "MARKDOWN"] })),
    options: { maxSpaces: 3, maxNeurons: 10, maxResultsPerRequest: 5, ranking: "context", ...args.options },
  };
}

/** Budget includes JSON escaping, IDs and metadata, not just body text. */
export function compactSearchResult(information: RetrievedInformation, budget = 6000): string {
  if (!Number.isInteger(budget) || budget < 2) throw new RangeError("Budget must be at least 2 characters");
  const result = { spaceIds: [] as string[], neuronIds: [] as string[], results: [] as object[], truncated: false };
  const fits = () => JSON.stringify({ ...result, truncated: false }).length <= budget;
  for (const [key, ids] of [["spaceIds", information.plan.resolvedSpaceIds], ["neuronIds", information.plan.resolvedNeuronIds]] as const) {
    for (const id of ids) { result[key].push(id); if (!fits()) { result[key].pop(); result.truncated = true; } }
  }
  const seen = new Set<string>();
  for (const request of information.requests) for (const item of request.results) {
    if (item.sourceType !== "NEURON" && item.sourceType !== "MARKDOWN") continue;
    const key = JSON.stringify([item.subjectId, item.neuronId, item.heading, item.content]);
    if (seen.has(key)) continue;
    seen.add(key);
    const compact = { requestId: request.requestId, spaceId: item.subjectId, spaceName: item.subjectName,
      neuronId: item.neuronId, title: item.title, sourceType: item.sourceType, sourceId: item.sourceId,
      heading: item.heading, content: item.content };
    result.results.push(compact);
    if (!fits()) {
      result.truncated = true;
      let low = 0, high = compact.content.length;
      const content = compact.content;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        compact.content = content.slice(0, mid);
        if (fits()) low = mid; else high = mid - 1;
      }
      compact.content = content.slice(0, low);
      if (!low || !fits()) result.results.pop();
    }
  }
  const output = JSON.stringify(result);
  return output.length <= budget ? output : "{}";
}
