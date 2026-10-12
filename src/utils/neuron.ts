import type { NeuronConnection } from "../types";

export const NEURON_COLOR_PALETTE = [
  { label: "Xanh dương", value: "#3B82F6" },
  { label: "Tím", value: "#A855F7" },
  { label: "Xanh ngọc", value: "#20D6C7" },
  { label: "Xanh lá", value: "#34C38F" },
  { label: "Cam", value: "#FB923C" },
  { label: "Vàng", value: "#FACC15" },
  { label: "Hồng", value: "#EC4899" },
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
