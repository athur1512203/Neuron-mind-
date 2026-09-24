import type { Neuron, NeuronConnection, Subject } from "../types";
import { initialConnections, initialNeurons, subjects as seedSubjects } from "../data/mockData";

const STORAGE_KEY = "neuromind-graph-v1";

export type GraphPersist = {
  subjects: Subject[];
  neurons: Neuron[];
  connections: NeuronConnection[];
};

function withSubjectColor(subject: Subject): Subject {
  if (subject.color) return subject;
  const seed = seedSubjects.find((item) => item.id === subject.id);
  return { ...subject, color: seed?.color ?? "#22c55e" };
}

export function loadGraph(): GraphPersist {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { subjects: seedSubjects, neurons: initialNeurons, connections: initialConnections };
    }
    const parsed = JSON.parse(raw) as Partial<GraphPersist>;
    if (!Array.isArray(parsed.subjects) || !Array.isArray(parsed.neurons) || !Array.isArray(parsed.connections)) {
      return { subjects: seedSubjects, neurons: initialNeurons, connections: initialConnections };
    }
    return {
      subjects: parsed.subjects.map(withSubjectColor),
      neurons: parsed.neurons,
      connections: parsed.connections,
    };
  } catch {
    return { subjects: seedSubjects, neurons: initialNeurons, connections: initialConnections };
  }
}

export function saveGraph(data: GraphPersist) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
