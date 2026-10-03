import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireOwnedNeuron, requireOwnedSubject } from "../services/ownership";
import { routeParam } from "../utils/request";

const media = { images: true, audio: true } as const;

export async function createNeuron(request: Request, response: Response) {
  const subject = await requireOwnedSubject(routeParam(request, "subjectId"), request.userId);
  const neuron = await prisma.neuron.create({
    data: { ...request.body, subjectId: subject.id },
    include: media,
  });
  response.status(201).json(neuron);
}

export async function listNeurons(request: Request, response: Response) {
  const subject = await requireOwnedSubject(routeParam(request, "subjectId"), request.userId);
  const neurons = await prisma.neuron.findMany({
    where: { subjectId: subject.id },
    include: media,
    orderBy: { createdAt: "asc" },
  });
  response.json(neurons);
}

export async function getNeuron(request: Request, response: Response) {
  response.json(await requireOwnedNeuron(routeParam(request, "id"), request.userId));
}

export async function updateNeuron(request: Request, response: Response) {
  const neuron = await requireOwnedNeuron(routeParam(request, "id"), request.userId);
  const updated = await prisma.neuron.update({
    where: { id: neuron.id },
    data: request.body,
    include: media,
  });
  response.json(updated);
}

export async function deleteNeuron(request: Request, response: Response) {
  const neuron = await requireOwnedNeuron(routeParam(request, "id"), request.userId);
  await prisma.neuron.delete({ where: { id: neuron.id } });
  response.status(204).send();
}
