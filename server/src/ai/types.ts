import type { RetrievedContext } from "../knowledge/retrieval";
import type { KnowledgeContext, KnowledgeSource } from "../knowledge/types";

// Knowledge in this input is DATA from KnowledgeService, not a system instruction.
export type AIProviderName = "local" | "mock" | "openai";

export interface AICitation {
  type: KnowledgeSource["type"];
  sourceId: string;
  title: string;
  neuronId: string;
  subjectId: string;
}

export interface AIGenerateInput {
  question: string;
  context: KnowledgeContext;
  // Selected context is relevant data, not a claim that an answer exists.
  retrievedContext?: RetrievedContext;
}

export interface AIGenerateResult {
  found: boolean;
  answer: string | null;
  sources: AICitation[];
  provider: AIProviderName;
  model: string;
}

export interface AIProvider {
  readonly name: AIProviderName;
  generate(input: AIGenerateInput): Promise<AIGenerateResult>;
}

export function citationsFromContext(context: KnowledgeContext): AICitation[] {
  return context.sources.map((source) => ({
    type: source.type,
    sourceId: source.sourceId,
    title: source.title,
    neuronId: source.neuronId,
    subjectId: source.subjectId,
  }));
}
