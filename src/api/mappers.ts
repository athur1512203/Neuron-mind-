import type { Neuron, NeuronConnection, Subject } from "../types";

export type ApiUser = {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiSubject = {
  id: string;
  name: string;
  color: string | null;
  neuronCount?: number;
  connectionCount?: number;
};

export type ApiMedia = {
  url: string;
};

export type ApiNeuron = {
  id: string;
  subjectId: string;
  name: string;
  color: string;
  textContent: string;
  note: string | null;
  keyPoints: string;
  memoryMethod: string;
  application: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  createdAt: string;
  updatedAt: string;
  images?: ApiMedia[];
  audio?: ApiMedia[];
};

export type ApiConnection = {
  id: string;
  subjectId: string;
  sourceNeuronId: string;
  targetNeuronId: string;
  createdAt: string;
};

export function mapSubject(subject: ApiSubject): Subject {
  return {
    id: subject.id,
    name: subject.name,
    color: subject.color ?? "#22c55e",
    neuronCount: subject.neuronCount ?? 0,
    connectionCount: subject.connectionCount ?? 0,
  };
}

export function mapNeuron(neuron: ApiNeuron): Neuron {
  return {
    id: neuron.id,
    subjectId: neuron.subjectId,
    name: neuron.name,
    color: neuron.color,
    position: {
      x: neuron.positionX,
      y: neuron.positionY,
      z: neuron.positionZ,
    },
    textContent: neuron.textContent,
    note: neuron.note ?? null,
    keyPoints: neuron.keyPoints,
    memoryMethod: neuron.memoryMethod,
    application: neuron.application,
    images: (neuron.images ?? []).map((item) => item.url),
    audio: (neuron.audio ?? []).map((item) => item.url),
    createdAt: String(neuron.createdAt),
    updatedAt: String(neuron.updatedAt),
  };
}

export function mapConnection(connection: ApiConnection): NeuronConnection {
  return {
    id: connection.id,
    subjectId: connection.subjectId,
    sourceNeuronId: connection.sourceNeuronId,
    targetNeuronId: connection.targetNeuronId,
    explanation: "",
    createdAt: String(connection.createdAt),
    updatedAt: String(connection.createdAt),
  };
}
