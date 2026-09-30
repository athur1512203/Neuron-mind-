import { buildRetrievalTemplate, extractKnownTerms as tokens, normalize } from "../knowledge/query";
import { chunkMarkdown } from "../knowledge/chunking";
import type { KnowledgeSource } from "../knowledge/types";
import type { RetrievedChunk } from "./types";
export function rankContextSources(sources: KnowledgeSource[], question: string, limit = 3): RetrievedChunk[] {
  const retrievalQuery = buildRetrievalTemplate(question);
  const query = [...new Set(retrievalQuery.knownTerms)];
  const candidates = sources
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
    // Wildcards are boundaries, never match-all expressions or tokens.
    const bodyPhrase = ` ${tokens(content).join(" ")} `;
    const phrases = retrievalQuery.template.split("...").map((part) => tokens(part));
    if (score > 0 && phrases.some((terms) => terms.length > 1 && bodyPhrase.includes(` ${terms.join(" ")} `))) score += 2;
    return { sourceType: source.type, sourceId: source.sourceId, neuronId: source.neuronId,
      subjectId: source.subjectId, title: source.title, updatedAt: source.updatedAt, heading, content, score };
  }).filter((chunk) => chunk.score > 0);
  // Stable sort retains source/chunk order on ties. No mandatory domain phrases or synonym rules.
  chunks.sort((a, b) => b.score - a.score);
  return chunks.slice(0, limit);
}

