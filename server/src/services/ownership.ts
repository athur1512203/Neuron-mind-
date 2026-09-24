import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";

export async function requireOwnedSubject(subjectId: string, userId: string) {
  const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId } });
  if (!subject) throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");
  return subject;
}

export async function requireOwnedNeuron(neuronId: string, userId: string) {
  const neuron = await prisma.neuron.findFirst({
    where: { id: neuronId, subject: { userId } },
    include: { images: true, audio: true },
  });
  if (!neuron) throw new AppError(404, "NEURON_NOT_FOUND", "Neuron not found");
  return neuron;
}

export async function requireOwnedConnection(connectionId: string, userId: string) {
  const connection = await prisma.neuronConnection.findFirst({
    where: { id: connectionId, subject: { userId } },
  });
  if (!connection) throw new AppError(404, "CONNECTION_NOT_FOUND", "Connection not found");
  return connection;
}
