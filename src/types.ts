export type Position3D = {
  x: number;
  y: number;
  z: number;
};

export type Subject = {
  id: string;
  name: string;
  description?: string;
  color: string;
  neuronCount: number;
  connectionCount: number;
};

export type Neuron = {
  id: string;
  subjectId: string;
  name: string;
  color: string;
  position: Position3D;
  textContent: string;
  note?: string | null;
  images: string[];
  audio: string[];
  keyPoints: string;
  memoryMethod: string;
  application: string;
  createdAt: string;
  updatedAt: string;
};

export type NeuronConnection = {
  id: string;
  subjectId: string;
  sourceNeuronId: string;
  targetNeuronId: string;
  explanation: string;
  createdAt: string;
  updatedAt: string;
};

export type ViewName = "dashboard" | "map" | "connections" | "settings";

export type Selection =
  | { type: "neuron"; id: string }
  | { type: "connection"; id: string }
  | null;
