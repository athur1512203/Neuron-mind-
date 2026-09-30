import { rankContextSources } from "../search/ranking";
import type { KnowledgeContext, KnowledgeSource } from "./types";

export const TOP_K = 3;

import type { RetrievedChunk } from "../search/types";
export type { RetrievedChunk } from "../search/types";

/** Relevant context is not evidence that the question can be answered. */
export interface RetrievedContext {
  neuronId: string;
  subjectId: string;
  chunks: RetrievedChunk[];
}

// Compatibility adapter: the ranking implementation lives only in Search Core.
export function retrieveContext(context: KnowledgeContext, question: string): RetrievedContext {
  return { neuronId: context.neuronId, subjectId: context.subjectId,
    chunks: rankContextSources(context.sources.filter((source) => source.type !== "DOCUMENT"), question, TOP_K) };
}

/** Compatibility view for existing providers; only selected content and allowlisted metadata. */
export function selectedKnowledgeContext(retrieved: RetrievedContext): KnowledgeContext {
  const sources = new Map<string, KnowledgeSource>();
  for (const chunk of retrieved.chunks) {
    const key = JSON.stringify([chunk.sourceType, chunk.sourceId, chunk.neuronId, chunk.subjectId]);
    const content = chunk.heading ? `## ${chunk.heading}\n${chunk.content}` : chunk.content;
    const source = sources.get(key);
    if (source) source.content += `\n\n${content}`;
    else sources.set(key, { type: chunk.sourceType, sourceId: chunk.sourceId, neuronId: chunk.neuronId,
      subjectId: chunk.subjectId, title: chunk.title, content, updatedAt: chunk.updatedAt,
      provenance: { sourceType: chunk.sourceType, sourceId: chunk.sourceId,
        neuronId: chunk.neuronId, subjectId: chunk.subjectId } });
  }
  return { neuronId: retrieved.neuronId, subjectId: retrieved.subjectId, sources: [...sources.values()] };
}

export function serializeRetrievedContext(context: RetrievedContext, question: string): string {
  return `KNOWLEDGE CONTEXT\n\n${context.chunks.map((chunk, index) =>
    `[SOURCE ${index + 1}]\nType: ${chunk.sourceType}\nTitle: ${chunk.title}\nHeading: ${chunk.heading}\nContent:\n${chunk.content}`
  ).join("\n\n")}\n\nQUESTION:\n${question}`;
}
