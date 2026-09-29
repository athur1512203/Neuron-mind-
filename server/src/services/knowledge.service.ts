import { MarkdownKnowledgeProvider, NeuronKnowledgeProvider } from "../knowledge/providers";
import { assertKnowledgeScope, type KnowledgeContext, type KnowledgeScope, type KnowledgeSourceProvider } from "../knowledge/types";
import { requireOwnedNeuron } from "./ownership";

export class KnowledgeService {
  constructor(private readonly providers: readonly KnowledgeSourceProvider[]) {}

  async getKnowledgeContext(scope: KnowledgeScope): Promise<KnowledgeContext> {
    assertKnowledgeScope(scope);
    // Reuse the existing 404 behavior for both absent and foreign neurons.
    const neuron = await requireOwnedNeuron(scope.neuronId, scope.userId);
    const sources = (await Promise.all(this.providers.map((provider) => provider.getSources(scope)))).flat();
    return { neuronId: neuron.id, subjectId: neuron.subjectId, sources };
  }

  async getKnowledgeSourcesForNeuron(scope: KnowledgeScope) {
    return (await this.getKnowledgeContext(scope)).sources;
  }
}

// Composition only: consumers depend on the service/DTO, not Prisma models.
export const knowledgeService = new KnowledgeService([
  new NeuronKnowledgeProvider(),
  new MarkdownKnowledgeProvider(),
]);
