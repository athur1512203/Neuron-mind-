import { prisma } from "../lib/prisma";
import { assertKnowledgeScope, type KnowledgeScope, type KnowledgeSource, type KnowledgeSourceProvider } from "./types";

export class NeuronKnowledgeProvider implements KnowledgeSourceProvider {
  readonly type = "NEURON" as const;

  async getSources(scope: KnowledgeScope): Promise<KnowledgeSource[]> {
    assertKnowledgeScope(scope);
    const neuron = await prisma.neuron.findFirst({
      where: { id: scope.neuronId, subject: { userId: scope.userId } },
      select: {
        id: true, subjectId: true, name: true, updatedAt: true,
        textContent: true, note: true, keyPoints: true, memoryMethod: true, application: true,
      },
    });
    if (!neuron) return [];

    const sections: Array<[string, string | null]> = [
      ["Text", neuron.textContent],
      ["Note", neuron.note],
      ["Key points", neuron.keyPoints],
      ["Memory method", neuron.memoryMethod],
      ["Application", neuron.application],
    ];
    const content = sections
      .filter(([, value]) => value?.trim())
      .map(([label, value]) => `## ${label}\n${value}`)
      .join("\n\n");

    return [{
      type: this.type,
      sourceId: neuron.id,
      neuronId: neuron.id,
      subjectId: neuron.subjectId,
      title: neuron.name,
      content,
      updatedAt: neuron.updatedAt.toISOString(),
      provenance: {
        sourceType: this.type, sourceId: neuron.id,
        neuronId: neuron.id, subjectId: neuron.subjectId,
      },
    }];
  }
}

export class MarkdownKnowledgeProvider implements KnowledgeSourceProvider {
  readonly type = "MARKDOWN" as const;

  async getSources(scope: KnowledgeScope): Promise<KnowledgeSource[]> {
    assertKnowledgeScope(scope);
    const note = await prisma.markdownNote.findFirst({
      where: { neuronId: scope.neuronId, neuron: { subject: { userId: scope.userId } } },
      select: {
        id: true, neuronId: true, content: true, updatedAt: true,
        neuron: { select: { subjectId: true, name: true } },
      },
    });
    if (!note) return [];

    return [{
      type: this.type,
      sourceId: note.id,
      neuronId: note.neuronId,
      subjectId: note.neuron.subjectId,
      title: note.neuron.name,
      content: note.content,
      updatedAt: note.updatedAt.toISOString(),
      provenance: {
        sourceType: this.type, sourceId: note.id,
        neuronId: note.neuronId, subjectId: note.neuron.subjectId,
      },
    }];
  }
}
