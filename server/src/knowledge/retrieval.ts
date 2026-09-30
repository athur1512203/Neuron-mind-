import { chunkMarkdown } from "./chunking";
import type { KnowledgeContext, KnowledgeSource } from "./types";

export const TOP_K = 3;

export interface RetrievedChunk {
  sourceType: KnowledgeSource["type"];
  sourceId: string;
  neuronId: string;
  subjectId: string;
  title: string;
  updatedAt: string;
  heading: string;
  content: string;
  score: number;
}

/** Relevant context is not evidence that the question can be answered. */
export interface RetrievedContext {
  neuronId: string;
  subjectId: string;
  chunks: RetrievedChunk[];
}

const QUESTION_WORDS = new Set([
  "ai", "gì", "nào", "mấy", "bao", "nhiêu", "ở", "đâu", "khi", "như", "thế",
  "cho", "tôi", "biết", "hãy", "vui", "lòng", "là", "của", "có", "không", "và", "hay",
  "được", "này", "trong", "với", "thì", "về", "các", "những", "một",
  "who", "what", "when", "where", "why", "how", "is", "are", "the", "of", "to", "and",
]);

function normalize(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
}

function tokens(text: string): string[] {
  return normalize(text).split(/\s+/).filter((token) => token && !QUESTION_WORDS.has(token));
}

export function retrieveContext(context: KnowledgeContext, question: string): RetrievedContext {
  const query = [...new Set(tokens(question))];
  const candidates = context.sources
    .filter((source) => source.type === "NEURON" || source.type === "MARKDOWN")
    .flatMap((source) => chunkMarkdown(source.content ?? "").map((chunk) => ({ source, ...chunk })));
  // Remove repeated provider content before scoring, so duplicates do not change rarity or TOP_K.
  const seen = new Set<string>();
  const unique = candidates.filter(({ source, heading, content }) => {
    const key = JSON.stringify([source.type, source.sourceId, source.neuronId, source.subjectId,
      normalize(heading), normalize(content)]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const tokenSets = unique.map(({ source, heading, content }) => new Set(tokens(`${source.title} ${heading} ${content}`)));
  const weights = new Map(query.map((token) => [token,
    1 + Math.log((unique.length + 1) / (1 + tokenSets.filter((set) => set.has(token)).length))]));
  const chunks = unique.map(({ source, heading, content }, index): RetrievedChunk => {
    const body = new Set(tokens(content));
    const title = new Set(tokens(`${source.title} ${heading}`));
    let score = 0;
    for (const token of query) {
      if (tokenSets[index].has(token)) {
        score += (weights.get(token) ?? 1) * ((body.has(token) ? 1 : 0) + (title.has(token) ? 1.5 : 0));
      }
    }
    const phrase = tokens(question).join(" ");
    if (query.length > 1 && ` ${tokens(content).join(" ")} `.includes(` ${phrase} `)) score += 2;
    return { sourceType: source.type, sourceId: source.sourceId, neuronId: source.neuronId,
      subjectId: source.subjectId, title: source.title, updatedAt: source.updatedAt, heading, content, score };
  }).filter((chunk) => chunk.score > 0);
  // Stable sort retains source/chunk order on ties. No mandatory domain phrases or synonym rules.
  chunks.sort((a, b) => b.score - a.score);
  return { neuronId: context.neuronId, subjectId: context.subjectId, chunks: chunks.slice(0, TOP_K) };
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
