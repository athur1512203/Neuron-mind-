import { resolveAIProvider } from "../ai/resolve";
import type { AIGenerateResult, AIProvider } from "../ai/types";
import { localAnswerFromKnowledge, type NeuroChatMessage, type NeuroChatResult } from "../ai/local-answer";
import type { KnowledgeContext } from "../knowledge/types";
import { retrieveContext, selectedKnowledgeContext } from "../knowledge/retrieval";
import { knowledgeService } from "./knowledge.service";
import type { KnowledgeService } from "./knowledge.service";

export type { NeuroChatMessage, NeuroChatResult, NeuroCitation } from "../ai/local-answer";

// Public local V0 compatibility adapter. Retrieval itself produces no answer.
export function answerFromKnowledge(context: KnowledgeContext, message: string, history: NeuroChatMessage[] = []): NeuroChatResult {
  return localAnswerFromKnowledge(selectedKnowledgeContext(retrieveContext(context, message)), message, history);
}

function miss(context: KnowledgeContext): NeuroChatResult {
  return { neuronId: context.neuronId, subjectId: context.subjectId, found: false, answer: null, sources: [] };
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
    const retrievedContext = retrieveContext(context, input.message);
    const selectedContext = selectedKnowledgeContext(retrievedContext);
    if (!this.aiProvider) {
      return localAnswerFromKnowledge(selectedContext, input.message, input.history ?? []);
    }
    return fromAIResult(
      context,
      await this.aiProvider.generate({
        question: input.message,
        context: selectedContext,
        retrievedContext,
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
