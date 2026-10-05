import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { buildRetrievalTemplate, normalize } from "../knowledge/query";
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

// Names only: NFC/case/punctuation normalization must agree with context retrieval.
// Page metadata rather than fetching content or truncating before relevance ordering.
async function resolveNames<T extends { id: string; name: string }>(
  fetchPage: (cursor?: string) => Promise<T[]>, query: string | undefined, limit: number,
): Promise<T[]> {
  const normalized = normalize(query ?? "");
  const terms = normalized.split(/\s+/).filter(Boolean);
  const score = (name: string) => !query ? 1 : name === query ? 4 :
    normalize(name) === normalized && normalized ? 3 :
    terms.length && terms.some((term) => normalize(name).includes(term)) ? 2 : 0;
  let candidates: T[] = [], cursor: string | undefined;
  while (true) {
    const page = await fetchPage(cursor);
    candidates = [...candidates, ...page.filter((row) => score(row.name) > 0)]
      .sort((a, b) => score(b.name) - score(a.name) || a.id.localeCompare(b.id)).slice(0, limit);
    if (page.length < 500) break;
    cursor = page[page.length - 1].id;
  }
  return candidates;
}

export class PrismaSearchRepository implements SearchRepository {
  async resolve(plan: SearchPlan): Promise<ResolvedScope> {
    if (plan.space?.id || plan.space?.query || plan.neuron?.id || plan.neuron?.query) {
      return this.resolveHierarchy(plan);
    }
    const terms = [...new Set(plan.requests.flatMap((request) => termsFor(plan, request.query)))];
    const contentMatches: Prisma.NeuronWhereInput[] = [
      ...neuronMatches(terms),
      { markdownNote: { is: { OR: terms.map((term) => ({ content: match(term) })) } } },
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
        ...(!plan.space?.id && !plan.space?.query ? { OR: [
          { neurons: { some: neuronFilter } },
          { documents: { some: { OR: documentMatches(terms) } } },
        ] } : {}) },
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

  private async resolveHierarchy(plan: SearchPlan): Promise<ResolvedScope> {
    const hasSpace = Boolean(plan.space?.id || plan.space?.query);
    const hasNeuron = Boolean(plan.neuron?.id || plan.neuron?.query);
    const maxSpaces = plan.options?.maxSpaces ?? 50;
    const maxNeurons = plan.options?.maxNeurons ?? 200;
    const spaces = hasSpace ? await resolveNames((cursor) => prisma.subject.findMany({
      where: { userId: plan.userId, ...(plan.space?.id ? { id: plan.space.id } : {}) },
      select: { id: true, name: true }, orderBy: { id: "asc" }, take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }), plan.space?.id ? undefined : plan.space?.query, maxSpaces) : [];
    if (plan.space?.id && !spaces.length) throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");
    let spaceIds = spaces.map((space) => space.id);
    // A failed name scope must never fall back to global content retrieval.
    if (hasSpace && !spaceIds.length) return { spaceIds: [], neuronIds: [] };
    if (!hasNeuron && !plan.requests.some((request) => request.query.trim())) return { spaceIds, neuronIds: [] };
    const terms = [...new Set(plan.requests.flatMap((request) => termsFor(plan, request.query)))];
    const neurons = await resolveNames((cursor) => prisma.neuron.findMany({
      where: { subject: { userId: plan.userId }, ...(hasSpace ? { subjectId: { in: spaceIds } } : {}),
        ...(plan.neuron?.id ? { id: plan.neuron.id } : {}),
        ...(!hasNeuron ? { OR: [ ...neuronMatches(terms),
          { markdownNote: { is: { OR: terms.map((term) => ({ content: match(term) })) } } } ] } : {}),
      }, select: { id: true, name: true, subjectId: true }, orderBy: { id: "asc" }, take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }), plan.neuron?.id ? undefined : plan.neuron?.query, maxNeurons);
    if (plan.neuron?.id && !neurons.length) throw new AppError(404, "NEURON_NOT_FOUND", "Neuron not found");
    if (!hasSpace) spaceIds = [...new Set(neurons.map((neuron) => neuron.subjectId))].slice(0, maxSpaces);
    return { spaceIds, neuronIds: neurons.filter((neuron) => spaceIds.includes(neuron.subjectId)).map((neuron) => neuron.id) };
  }

  async load(plan: SearchPlan, scope: ResolvedScope, request: SearchRequest): Promise<SearchSource[]> {
    if (!scope.spaceIds.length || ((plan.neuron?.id || plan.neuron?.query) && !scope.neuronIds.length)) return [];
    const terms = termsFor(plan, request.query);
    if (!terms.length) return [];
    const types = request.sources ?? ["NEURON", "MARKDOWN", "DOCUMENT"];
    const take = Math.min(50, (plan.options?.maxResultsPerRequest ?? 20) * 2);
    const neuronScope = { subject: { userId: plan.userId }, id: { in: scope.neuronIds }, subjectId: { in: scope.spaceIds } };
    const navigation = plan.options?.ranking === "navigation";
    const [neurons, notes, documents] = await Promise.all([
      types.includes("NEURON") && scope.neuronIds.length ? prisma.neuron.findMany({ where: { ...neuronScope, OR: neuronMatches(terms) },
        select: { ...parentSelect, textContent: true, note: true, keyPoints: true, memoryMethod: true, application: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take }) : [],
      types.includes("MARKDOWN") && scope.neuronIds.length ? prisma.markdownNote.findMany({ where: { neuron: neuronScope,
        ...(navigation ? { content: match(request.query.trim()) } : { OR: [
          ...terms.map((term) => ({ content: match(term) })),
          ...terms.map((term) => ({ neuron: { name: match(term) } })),
        ] }) }, select: { id: true, neuronId: true, content: true, updatedAt: true, neuron: { select: parentSelect } },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take }) : [],
      types.includes("DOCUMENT") ? prisma.document.findMany({ where: {
        subject: { userId: plan.userId }, subjectId: { in: scope.spaceIds }, OR: documentMatches(terms) },
        select: { id: true, subjectId: true, originalName: true, mimeType: true, extension: true,
          size: true, updatedAt: true, subject: { select: { name: true } } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take }) : [],
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
      ...documents.map((doc): SearchSource => ({ type: "DOCUMENT", sourceId: doc.id, subjectId: doc.subjectId,
        title: doc.originalName, subjectName: doc.subject.name, updatedAt: doc.updatedAt.toISOString(),
        provenance: { sourceType: "DOCUMENT", sourceId: doc.id, subjectId: doc.subjectId },
        content: `${doc.originalName}\n${doc.mimeType}`, metadata: { fileName: doc.originalName, mimeType: doc.mimeType, fileSize: doc.size },
        searchText: [doc.originalName, doc.mimeType, doc.extension].filter(Boolean).join(" "),
        snippetFields: [doc.originalName, doc.mimeType, doc.extension] })),
    ];
  }
}
