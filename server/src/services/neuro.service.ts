import { resolveAIProvider } from "../ai/resolve";
import type { AIGenerateResult, AIProvider } from "../ai/types";
import type { KnowledgeContext, KnowledgeSource } from "../knowledge/types";
import { knowledgeService } from "./knowledge.service";
import type { KnowledgeService } from "./knowledge.service";

export type NeuroChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type NeuroCitation = {
  type: KnowledgeSource["type"];
  sourceId: string;
  title: string;
  neuronId: string;
  subjectId: string;
};

export type NeuroChatResult = {
  neuronId: string;
  subjectId: string;
  found: boolean;
  answer: string | null;
  sources: NeuroCitation[];
};

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "is", "it",
  "of", "on", "or", "that", "the", "this", "to", "what", "when", "where", "which", "who", "why",
  "với", "của", "và", "là", "các", "những", "một", "trong", "cho", "được", "có", "không",
  "này", "kia", "thì", "về", "như", "hay", "hỏi", "giải", "thích",
]);

const MAX_PASSAGES = 3;
const MAX_PASSAGE_CHARS = 900;
const MAX_REPLY_CHARS = 4000;

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function splitPassages(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function scorePassage(passage: string, queryTokens: string[]): number {
  if (!queryTokens.length) return 0;
  const passageTokens = new Set(tokens(passage));
  let score = 0;
  for (const token of queryTokens) {
    if (passageTokens.has(token)) score += 1;
  }
  return score;
}

function cite(source: KnowledgeSource): NeuroCitation {
  return {
    type: source.type,
    sourceId: source.sourceId,
    title: source.title,
    neuronId: source.neuronId,
    subjectId: source.subjectId,
  };
}

function miss(context: KnowledgeContext): NeuroChatResult {
  return {
    neuronId: context.neuronId,
    subjectId: context.subjectId,
    found: false,
    answer: null,
    sources: [],
  };
}

export function answerFromKnowledge(
  context: KnowledgeContext,
  message: string,
  _history: NeuroChatMessage[] = [],
): NeuroChatResult {
  const usableSources = context.sources.filter((source) => typeof source.content === "string" && source.content.trim());
  if (!usableSources.length) return miss(context);

  // Retrieval uses only the current question. Prior turns must not leak relevance.
  const queryTokens = [...new Set(tokens(message))];
  if (!queryTokens.length) return miss(context);

  const ranked: Array<{ source: KnowledgeSource; passage: string; score: number }> = [];
  for (const source of usableSources) {
    const passages = splitPassages(source.content ?? "");
    const chunks = passages.length ? passages : [source.content ?? ""];
    for (const passage of chunks) {
      const score = scorePassage(passage, queryTokens);
      if (score > 0) ranked.push({ source, passage, score });
    }
  }
  ranked.sort((a, b) => b.score - a.score);

  const selected = ranked.slice(0, MAX_PASSAGES);
  if (!selected.length) return miss(context);

  const sources: NeuroCitation[] = [];
  const seen = new Set<string>();
  const sections: string[] = [];
  let used = 0;

  for (const item of selected) {
    const excerpt = item.passage.length > MAX_PASSAGE_CHARS
      ? `${item.passage.slice(0, MAX_PASSAGE_CHARS).trimEnd()}…`
      : item.passage;
    const block = sections.length ? `\n\n${excerpt}` : excerpt;
    if (used + block.length > MAX_REPLY_CHARS) break;
    sections.push(block);
    used += block.length;
    const key = `${item.source.type}:${item.source.sourceId}`;
    if (!seen.has(key)) {
      seen.add(key);
      sources.push(cite(item.source));
    }
  }

  if (!sections.length) return miss(context);

  return {
    neuronId: context.neuronId,
    subjectId: context.subjectId,
    found: true,
    answer: sections.join(""),
    sources,
  };
}

function fromAIResult(context: KnowledgeContext, generated: AIGenerateResult): NeuroChatResult {
  if (generated.found === false || generated.answer == null) {
    return miss(context);
  }
  return {
    neuronId: context.neuronId,
    subjectId: context.subjectId,
    found: true,
    answer: generated.answer,
    sources: generated.sources,
  };
}

export class NeuroService {
  constructor(
    private readonly knowledge: Pick<KnowledgeService, "getKnowledgeContext"> = knowledgeService,
    private readonly aiProvider: AIProvider | null = null,
  ) {}

  async ask(input: {
    neuronId: string;
    userId: string;
    message: string;
    history?: NeuroChatMessage[];
  }): Promise<NeuroChatResult> {
    const context = await this.knowledge.getKnowledgeContext({
      neuronId: input.neuronId,
      userId: input.userId,
    });
    if (!this.aiProvider) {
      return answerFromKnowledge(context, input.message, input.history ?? []);
    }
    return fromAIResult(
      context,
      await this.aiProvider.generate({
        question: input.message,
        context,
      }),
    );
  }
}

export const neuroService = new NeuroService(knowledgeService, resolveAIProvider());

export async function askNeuron(input: {
  neuronId: string;
  userId: string;
  message: string;
  history?: NeuroChatMessage[];
}): Promise<NeuroChatResult> {
  return neuroService.ask(input);
}
