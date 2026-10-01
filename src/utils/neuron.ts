import type { NeuronConnection } from "../types";

export const colorPresets = [
  { label: "Blue", value: "#4F8DF7" },
  { label: "Purple", value: "#A56AF5" },
  { label: "Green", value: "#48D597" },
  { label: "Yellow", value: "#F6BE4A" },
  { label: "Coral", value: "#FF6875" },
  { label: "Cyan", value: "#55B9E9" },
  { label: "Pink", value: "#EF72B6" },
];

export function getConnectionCount(neuronId: string, connections: NeuronConnection[]) {
  return connections.filter(
    (connection) => connection.sourceNeuronId === neuronId || connection.targetNeuronId === neuronId,
  ).length;
}

export function getNeuronRadius(connectionCount: number) {
  const baseRadius = 0.28;
  const growthFactor = 0.14;
  const minRadius = 0.28;
  const maxRadius = 0.78;
  return Math.min(maxRadius, Math.max(minRadius, baseRadius + Math.log(connectionCount + 1) * growthFactor));
}

export function areSameConnection(a: string, b: string, source: string, target: string) {
  return (a === source && b === target) || (a === target && b === source);
}
