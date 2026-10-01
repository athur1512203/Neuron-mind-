import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { buildRetrievalTemplate } from "../knowledge/query";
import { AppError } from "../utils/app-error";
import type { SearchPlan, SearchSource, SearchRequest } from "./types";

export interface ResolvedScope { spaceIds: string[]; neuronIds: string[] }
export interface SearchRepository {
  resolve(plan: SearchPlan): Promise<ResolvedScope>;
  load(plan: SearchPlan, scope: ResolvedScope, request: SearchRequest): Promise<SearchSource[]>;
}
const match = (query: string) => ({ contains: query, mode: "insensitive" as const });
const neuronFields = ["name", "textContent", "note", "keyPoints", "memoryMethod", "application"] as const;
const documentFields = ["originalName", "mimeType", "extension"] as const;
const termsFor = (plan: SearchPlan, query: string) => plan.options?.ranking === "navigation"
  ? [query.trim()] : [...new Set(buildRetrievalTemplate(query).knownTerms)];
const neuronMatches = (terms: string[]): Prisma.NeuronWhereInput[] => terms.flatMap((term) => neuronFields.map((field) => ({ [field]: match(term) })));
const documentMatches = (terms: string[]): Prisma.DocumentWhereInput[] => terms.flatMap((term) => documentFields.map((field) => ({ [field]: match(term) })));
const parentSelect = { id: true, name: true, subjectId: true, subject: { select: { name: true } } } as const;

export class PrismaSearchRepository implements SearchRepository {
  async resolve(plan: SearchPlan): Promise<ResolvedScope> {
    const terms = [...new Set(plan.requests.flatMap((request) => termsFor(plan, request.query)))];
    const contentMatches: Prisma.NeuronWhereInput[] = [
      ...neuronMatches(terms),
      { markdownNote: { is: { OR: terms.map((term) => ({ content: match(term) })) } } },
      { documents: { some: { OR: documentMatches(terms) } } },
    ];
    const neuronFilter: Prisma.NeuronWhereInput = {
      ...(plan.neuron?.id ? { id: plan.neuron.id } : {}),
      ...(plan.neuron?.query ? { name: match(plan.neuron.query) } : {}),
      ...(!plan.neuron?.id && !plan.neuron?.query ? { OR: contentMatches } : {}),
    };
    const subjects = await prisma.subject.findMany({
      where: { userId: plan.userId, ...(plan.space?.id ? { id: plan.space.id } : {}),
        ...(plan.space?.query ? { name: match(plan.space.query) } : {}),
        // Unscoped search resolves only spaces with potential content matches.
        ...(!plan.space?.id && !plan.space?.query ? { neurons: { some: neuronFilter } } : {}) },
      select: { id: true }, orderBy: { id: "asc" }, take: plan.options?.maxSpaces ?? 50,
    });
    if (plan.space?.id && !subjects.length) throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");
    const spaceIds = subjects.map((subject) => subject.id);
    const neurons = spaceIds.length ? await prisma.neuron.findMany({
      where: { subject: { userId: plan.userId }, subjectId: { in: spaceIds }, ...neuronFilter },
      select: { id: true }, orderBy: { id: "asc" }, take: plan.options?.maxNeurons ?? 200,
    }) : [];
    if (plan.neuron?.id && !neurons.length) throw new AppError(404, "NEURON_NOT_FOUND", "Neuron not found");
    return { spaceIds, neuronIds: neurons.map((neuron) => neuron.id) };
  }

  async load(plan: SearchPlan, scope: ResolvedScope, request: SearchRequest): Promise<SearchSource[]> {
    if (!scope.neuronIds.length) return [];
    const terms = termsFor(plan, request.query);
    if (!terms.length) return [];
    const types = request.sources ?? ["NEURON", "MARKDOWN", "DOCUMENT"];
    const take = Math.min(50, (plan.options?.maxResultsPerRequest ?? 20) * 2);
    const neuronScope = { subject: { userId: plan.userId }, id: { in: scope.neuronIds }, subjectId: { in: scope.spaceIds } };
    const navigation = plan.options?.ranking === "navigation";
    const [neurons, notes, documents] = await Promise.all([
      types.includes("NEURON") ? prisma.neuron.findMany({ where: { ...neuronScope, OR: neuronMatches(terms) },
        select: { ...parentSelect, textContent: true, note: true, keyPoints: true, memoryMethod: true, application: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take }) : [],
      types.includes("MARKDOWN") ? prisma.markdownNote.findMany({ where: { neuron: neuronScope,
        ...(navigation ? { content: match(request.query.trim()) } : { OR: [
          ...terms.map((term) => ({ content: match(term) })),
          ...terms.map((term) => ({ neuron: { name: match(term) } })),
        ] }) }, select: { id: true, neuronId: true, content: true, updatedAt: true, neuron: { select: parentSelect } },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take }) : [],
      types.includes("DOCUMENT") ? prisma.document.findMany({ where: { neuron: neuronScope, OR: documentMatches(terms) },
        select: { id: true, neuronId: true, originalName: true, mimeType: true, extension: true,
          size: true, updatedAt: true, neuron: { select: parentSelect } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take }) : [],
    ]);
    const base = (type: SearchSource["type"], id: string, neuron: { id: string; name: string; subjectId: string; subject: { name: string } }, updatedAt: Date) => ({
      type, sourceId: id, neuronId: neuron.id, subjectId: neuron.subjectId, title: neuron.name,
      subjectName: neuron.subject.name, updatedAt: updatedAt.toISOString(),
      provenance: { sourceType: type, sourceId: id, neuronId: neuron.id, subjectId: neuron.subjectId },
    });
    return [
      ...neurons.map((neuron): SearchSource => {
        const fields = [neuron.textContent, neuron.note ?? "", neuron.keyPoints, neuron.memoryMethod, neuron.application];
        return { ...base("NEURON", neuron.id, neuron, neuron.updatedAt), content: fields.filter(Boolean).join("\n\n") || neuron.name, snippetFields: fields };
      }),
      ...notes.map((note): SearchSource => ({ ...base("MARKDOWN", note.id, note.neuron, note.updatedAt), content: note.content, snippetFields: [note.content] })),
      ...documents.map((doc): SearchSource => ({ ...base("DOCUMENT", doc.id, doc.neuron, doc.updatedAt), title: doc.originalName,
        content: `${doc.originalName}\n${doc.mimeType}`, metadata: { fileName: doc.originalName, mimeType: doc.mimeType, fileSize: doc.size },
        searchText: [doc.originalName, doc.mimeType, doc.extension].filter(Boolean).join(" "),
        snippetFields: [doc.originalName, doc.mimeType, doc.extension] })),
    ];
  }
}
