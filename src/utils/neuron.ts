import type { NeuronConnection } from "../types";

export const NEURON_COLOR_PALETTE = [
  { label: "Blue", value: "#4F8DF7" },
  { label: "Purple", value: "#9B6BE8" },
  { label: "Green", value: "#45B985" },
  { label: "Orange", value: "#F29B52" },
  { label: "Red", value: "#E96565" },
  { label: "Cyan", value: "#4EB7C5" },
  { label: "Pink", value: "#D96FA5" },
];

export const colorPresets = NEURON_COLOR_PALETTE;

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
