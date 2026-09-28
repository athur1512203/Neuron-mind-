import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";
import { requireOwnedNeuron } from "./ownership";

export const MARKDOWN_NOTE_MAX_BYTES = 1024 * 1024;

export function assertMarkdownContent(content: unknown): string {
  if (typeof content !== "string") {
    throw new AppError(400, "VALIDATION_ERROR", "content must be a string");
  }
  if (Buffer.byteLength(content, "utf8") > MARKDOWN_NOTE_MAX_BYTES) {
    throw new AppError(413, "CONTENT_TOO_LARGE", "Markdown content exceeds 1MB");
  }
  return content;
}

function serializeNote(note: { id: string; neuronId: string; content: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: note.id,
    neuronId: note.neuronId,
    content: note.content,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

export async function getMarkdownNoteForUser(neuronId: string, userId: string) {
  const neuron = await requireOwnedNeuron(neuronId, userId);
  const note = await prisma.markdownNote.findUnique({ where: { neuronId: neuron.id } });
  if (!note) {
    return { neuronId: neuron.id, content: null };
  }
  return serializeNote(note);
}

export async function upsertMarkdownNoteForUser(neuronId: string, userId: string, content: unknown) {
  const markdown = assertMarkdownContent(content);
  const neuron = await requireOwnedNeuron(neuronId, userId);
  const note = await prisma.markdownNote.upsert({
    where: { neuronId: neuron.id },
    create: { neuronId: neuron.id, content: markdown },
    update: { content: markdown },
  });
  return serializeNote(note);
}
