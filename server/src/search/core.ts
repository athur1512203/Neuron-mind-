import { z } from "zod";
import { createHash } from "node:crypto";
import { AppError } from "../utils/app-error";
import { rankContextSources } from "./ranking";
import { PrismaSearchRepository, type SearchRepository } from "./repository";
import type { RetrievedInformation, RetrievedItem, SearchPlan, SearchSource } from "./types";

const scopeSchema = z.object({ id: z.string().trim().min(1).max(200).optional(), query: z.string().trim().min(1).max(4000).optional() });
const planSchema = z.object({
  userId: z.string().trim().min(1).max(200), space: scopeSchema.optional(), neuron: scopeSchema.optional(),
  requests: z.array(z.object({ id: z.string().trim().min(1).max(100), query: z.string().max(4000),
    sources: z.array(z.enum(["NEURON", "MARKDOWN", "DOCUMENT"])).min(1).max(3).optional(),
    purpose: z.string().max(1000).optional() })).min(1).max(10),
  options: z.object({ maxSpaces: z.number().int().min(1).max(100).optional(),
    maxNeurons: z.number().int().min(1).max(500).optional(), maxResultsPerRequest: z.number().int().min(1).max(50).optional(),
    includeRelatedNeurons: z.boolean().optional(), ranking: z.enum(["context", "navigation"]).optional() }).optional(),
});

function snippet(values: string[], query: string): string | undefined {
  for (const value of values) {
    const text = value.trim();
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index < 0) continue;
    const start = Math.max(0, index - 48), end = Math.min(text.length, index + query.length + 96);
    return `${start ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
  }
  return undefined;
}
const sourceKey = (source: { type?: string; sourceType?: string; sourceId: string; neuronId?: string; subjectId: string }) =>
  JSON.stringify([source.type ?? source.sourceType, source.sourceId, source.subjectId, source.neuronId]);

/** One execution engine; navigation is a compatibility ranking profile, not another engine. */
export class SearchCore {
  constructor(private readonly repository: SearchRepository = new PrismaSearchRepository()) {}

  async execute(input: SearchPlan): Promise<RetrievedInformation> {
    if (typeof input?.userId !== "string" || !input.userId.trim()) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authenticated user required");
    const parsed = planSchema.safeParse(input);
    if (!parsed.success || new Set(input.requests.map((request) => request.id.trim())).size !== input.requests.length) {
      throw new AppError(400, "INVALID_SEARCH_PLAN", "Invalid search plan or limits");
    }
    const plan = parsed.data;
    if (plan.options?.includeRelatedNeurons) throw new AppError(400, "RELATED_SEARCH_NOT_SUPPORTED", "Related-neuron traversal is not enabled");
    const active = plan.requests.filter((request) => request.query.trim());
    const scope = active.length ? await this.repository.resolve({ ...plan, requests: active }) : { spaceIds: [], neuronIds: [] };
    const canonical = new Map<string, RetrievedInformation["sources"][number]>();
    const requests: RetrievedInformation["requests"] = [];
    for (const request of plan.requests) {
      const sources = request.query.trim() ? await this.repository.load(plan, scope, request) : [];
      const allowed = sources.filter((source) => scope.spaceIds.includes(source.subjectId) && (!source.neuronId || scope.neuronIds.includes(source.neuronId))
        && (!request.sources || request.sources.includes(source.type)));
      const results = this.rank(allowed, request.query.trim(), plan.options?.maxResultsPerRequest ?? 20, plan.options?.ranking);
      for (const item of results) {
        const { id: _id, content: _content, heading: _heading, score: _score, snippet: _snippet, ...safe } = item;
        canonical.set(sourceKey(item), safe);
      }
      requests.push({ requestId: request.id, query: request.query, found: results.length > 0, results });
    }
    return { plan: { resolvedSpaceIds: scope.spaceIds, resolvedNeuronIds: scope.neuronIds }, requests, sources: [...canonical.values()] };
  }

  private rank(sources: SearchSource[], query: string, limit: number, profile = "context"): RetrievedItem[] {
    const byId = new Map(sources.map((source) => [sourceKey(source), source]));
    const chunks = profile === "navigation" ? [...byId.values()].map((source) => {
      const title = source.title.trim().toLowerCase(), needle = query.toLowerCase();
      const matches = [source.title, source.content ?? "", source.searchText ?? ""].some((text) => text.toLowerCase().includes(needle));
      const rank = title === needle ? 0 : title.startsWith(needle) ? 1 : title.includes(needle) ? 2 : source.type === "NEURON" ? 3 : 4;
      return { sourceType: source.type, sourceId: source.sourceId, subjectId: source.subjectId, neuronId: source.neuronId,
        title: source.title, heading: "", content: source.content ?? "", updatedAt: source.updatedAt, score: matches ? 5 - rank : 0 };
    }).filter((chunk) => chunk.score > 0).sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt)
      || a.sourceType.localeCompare(b.sourceType) || a.sourceId.localeCompare(b.sourceId))
      : rankContextSources(sources, query, Number.MAX_SAFE_INTEGER);
    return chunks.slice(0, limit).map((chunk) => {
      const source = byId.get(sourceKey(chunk))!;
      return { id: createHash("sha256").update(JSON.stringify([sourceKey(source), chunk.heading, chunk.content])).digest("hex"), sourceType: chunk.sourceType,
        sourceId: chunk.sourceId, subjectId: chunk.subjectId, neuronId: chunk.neuronId, title: chunk.title,
        heading: chunk.heading, content: chunk.content, score: chunk.score,
        provenance: { sourceType: chunk.sourceType, sourceId: chunk.sourceId, subjectId: chunk.subjectId, neuronId: chunk.neuronId },
        metadata: { updatedAt: chunk.updatedAt, fileName: source.metadata?.fileName, mimeType: source.metadata?.mimeType, fileSize: source.metadata?.fileSize },
        subjectName: source.subjectName, snippet: snippet(source.snippetFields ?? [chunk.content], query) };
    });
  }
}
export const searchCore = new SearchCore();
