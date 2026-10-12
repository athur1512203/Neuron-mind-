import type { NeuronConnection } from "../types";

export const NEURON_COLOR_PALETTE = [
  { label: "Cyan", value: "#19D9D2" },
  { label: "Blue", value: "#238BFA" },
  { label: "Teal", value: "#44D9AD" },
  { label: "Yellow", value: "#FFC45C" },
  { label: "Orange", value: "#FF873C" },
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
