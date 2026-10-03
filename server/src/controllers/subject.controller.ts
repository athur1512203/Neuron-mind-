import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { documentService } from "../services/document.service";
import { requireOwnedSubject } from "../services/ownership";
import { routeParam } from "../utils/request";

function withCounts<T extends { _count: { neurons: number; connections: number } }>(subject: T) {
  const { _count, ...data } = subject;
  return { ...data, neuronCount: _count.neurons, connectionCount: _count.connections };
}

export async function createSubject(request: Request, response: Response) {
  const subject = await prisma.subject.create({ data: { ...request.body, userId: request.userId } });
  response.status(201).json(subject);
}

export async function listSubjects(request: Request, response: Response) {
  const subjects = await prisma.subject.findMany({
    where: { userId: request.userId },
    include: { _count: { select: { neurons: true, connections: true } } },
    orderBy: { updatedAt: "desc" },
  });
  response.json(subjects.map(withCounts));
}

export async function getSubject(request: Request, response: Response) {
  const subjectId = routeParam(request, "id");
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, userId: request.userId },
    include: { _count: { select: { neurons: true, connections: true } } },
  });
  if (!subject) {
    await requireOwnedSubject(subjectId, request.userId);
    return;
  }
  response.json(withCounts(subject));
}

export async function updateSubject(request: Request, response: Response) {
  const subject = await requireOwnedSubject(routeParam(request, "id"), request.userId);
  const updated = await prisma.subject.update({ where: { id: subject.id }, data: request.body });
  response.json(updated);
}

export async function deleteSubject(request: Request, response: Response) {
  const subject = await requireOwnedSubject(routeParam(request, "id"), request.userId);
  const documents = await prisma.document.findMany({
    where: { subjectId: subject.id, subject: { userId: request.userId } },
    select: { id: true, storageProvider: true, storageKey: true },
  });
  const deletions = await Promise.allSettled(
    documents.map((document) => documentService.deleteObject(document)),
  );
  deletions.forEach((result) => {
    if (result.status === "rejected") console.error("Failed to delete space document file");
  });
  await prisma.subject.delete({ where: { id: subject.id } });
  response.status(204).send();
}

export async function getGraph(request: Request, response: Response) {
  const subjectId = routeParam(request, "subjectId");
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, userId: request.userId },
    include: {
      neurons: { include: { images: true, audio: true }, orderBy: { createdAt: "asc" } },
      connections: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!subject) {
    await requireOwnedSubject(subjectId, request.userId);
    return;
  }

  const connectionCounts = new Map<string, number>();
  for (const connection of subject.connections) {
    connectionCounts.set(connection.sourceNeuronId, (connectionCounts.get(connection.sourceNeuronId) ?? 0) + 1);
    connectionCounts.set(connection.targetNeuronId, (connectionCounts.get(connection.targetNeuronId) ?? 0) + 1);
  }

  const { neurons, connections, ...subjectData } = subject;
  response.json({
    subject: subjectData,
    neurons: neurons.map((neuron) => ({ ...neuron, connectionCount: connectionCounts.get(neuron.id) ?? 0 })),
    connections,
  });
}
