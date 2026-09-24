import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireOwnedConnection, requireOwnedSubject } from "../services/ownership";
import { AppError } from "../utils/app-error";
import { routeParam } from "../utils/request";

export async function listConnections(request: Request, response: Response) {
  const subject = await requireOwnedSubject(routeParam(request, "subjectId"), request.userId);
  const connections = await prisma.neuronConnection.findMany({
    where: { subjectId: subject.id },
    orderBy: { createdAt: "asc" },
  });
  response.json(connections);
}

export async function createConnection(request: Request, response: Response) {
  const subject = await requireOwnedSubject(routeParam(request, "subjectId"), request.userId);
  const { sourceNeuronId: firstId, targetNeuronId: secondId } = request.body;

  if (firstId === secondId) {
    throw new AppError(400, "SELF_CONNECTION_NOT_ALLOWED", "A neuron cannot connect to itself");
  }

  const neurons = await prisma.neuron.findMany({
    where: { id: { in: [firstId, secondId] }, subjectId: subject.id },
    select: { id: true },
  });
  if (neurons.length !== 2) {
    throw new AppError(404, "NEURON_NOT_FOUND", "Both neurons must exist in this subject");
  }

  const [sourceNeuronId, targetNeuronId] = [firstId, secondId].sort();
  try {
    const connection = await prisma.neuronConnection.create({
      data: { subjectId: subject.id, sourceNeuronId, targetNeuronId },
    });
    response.status(201).json(connection);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "CONNECTION_ALREADY_EXISTS", "Connection already exists");
    }
    throw error;
  }
}

export async function deleteConnection(request: Request, response: Response) {
  const connection = await requireOwnedConnection(routeParam(request, "id"), request.userId);
  await prisma.neuronConnection.delete({ where: { id: connection.id } });
  response.status(204).send();
}
