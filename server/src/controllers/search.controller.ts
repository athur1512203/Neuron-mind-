import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";

type SearchResultType = "neuron" | "markdown" | "document";

type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  snippet?: string;
  neuronId?: string;
  subjectId?: string;
  subjectName?: string;
  updatedAt?: string;
  rank: number;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parseLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(parsed)));
}

function textMatch(query: string) {
  return { contains: query, mode: "insensitive" as const };
}

function rankTitle(title: string, query: string, fallback: number) {
  const normalizedTitle = title.trim().toLowerCase();
  const normalizedQuery = query.toLowerCase();
  if (normalizedTitle === normalizedQuery) return 0;
  if (normalizedTitle.startsWith(normalizedQuery)) return 1;
  if (normalizedTitle.includes(normalizedQuery)) return 2;
  return fallback;
}

function snippetFrom(value: string | null | undefined, query: string) {
  const source = value?.trim();
  if (!source) return undefined;
  const normalized = source.toLowerCase();
  const index = normalized.indexOf(query.toLowerCase());
  if (index < 0) return undefined;
  const start = Math.max(0, index - 48);
  const end = Math.min(source.length, index + query.length + 96);
  return `${start > 0 ? "..." : ""}${source.slice(start, end)}${end < source.length ? "..." : ""}`;
}

function firstSnippet(values: Array<string | null | undefined>, query: string) {
  for (const value of values) {
    const snippet = snippetFrom(value, query);
    if (snippet) return snippet;
  }
  return undefined;
}

export async function searchGlobal(request: Request, response: Response) {
  const query = String(request.query.q ?? "").trim();
  const limit = parseLimit(request.query.limit);
  if (!query) {
    response.json({ query, limit, results: [] });
    return;
  }

  const take = Math.min(MAX_LIMIT, limit * 2);
  const [neurons, markdownNotes, documents] = await Promise.all([
    prisma.neuron.findMany({
      where: {
        subject: { userId: request.userId },
        OR: [
          { name: textMatch(query) },
          { textContent: textMatch(query) },
          { note: textMatch(query) },
          { keyPoints: textMatch(query) },
          { memoryMethod: textMatch(query) },
          { application: textMatch(query) },
        ],
      },
      include: { subject: true },
      orderBy: { updatedAt: "desc" },
      take,
    }),
    prisma.markdownNote.findMany({
      where: {
        content: textMatch(query),
        neuron: { subject: { userId: request.userId } },
      },
      include: { neuron: { include: { subject: true } } },
      orderBy: { updatedAt: "desc" },
      take,
    }),
    prisma.document.findMany({
      where: {
        neuron: { subject: { userId: request.userId } },
        OR: [
          { originalName: textMatch(query) },
          { storedName: textMatch(query) },
          { mimeType: textMatch(query) },
          { extension: textMatch(query) },
          { checksum: textMatch(query) },
        ],
      },
      include: { neuron: { include: { subject: true } } },
      orderBy: { updatedAt: "desc" },
      take,
    }),
  ]);

  const results: SearchResult[] = [
    ...neurons.map((neuron) => ({
      id: neuron.id,
      type: "neuron" as const,
      title: neuron.name,
      snippet: firstSnippet([neuron.textContent, neuron.note, neuron.keyPoints, neuron.memoryMethod, neuron.application], query),
      neuronId: neuron.id,
      subjectId: neuron.subjectId,
      subjectName: neuron.subject.name,
      updatedAt: neuron.updatedAt.toISOString(),
      rank: rankTitle(neuron.name, query, 3),
    })),
    ...markdownNotes.map((note) => ({
      id: note.id,
      type: "markdown" as const,
      title: note.neuron.name,
      snippet: snippetFrom(note.content, query),
      neuronId: note.neuronId,
      subjectId: note.neuron.subjectId,
      subjectName: note.neuron.subject.name,
      updatedAt: note.updatedAt.toISOString(),
      rank: rankTitle(note.neuron.name, query, 4),
    })),
    ...documents.map((document) => ({
      id: document.id,
      type: "document" as const,
      title: document.originalName,
      snippet: firstSnippet([document.originalName, document.mimeType, document.extension, document.checksum], query),
      neuronId: document.neuronId,
      subjectId: document.neuron.subjectId,
      subjectName: document.neuron.subject.name,
      updatedAt: document.updatedAt.toISOString(),
      rank: rankTitle(document.originalName, query, 4),
    })),
  ];

  results.sort((left, right) => left.rank - right.rank || String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? "")));

  response.json({
    query,
    limit,
    results: results.slice(0, limit).map(({ rank: _rank, ...result }) => result),
  });
}
