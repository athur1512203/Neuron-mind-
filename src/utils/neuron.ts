import type { NeuronConnection } from "../types";

export const NEURON_COLOR_PALETTE = [
  { label: "Xanh dương", value: "#3B82F6" },
  { label: "Tím", value: "#A855F7" },
  { label: "Xanh lá", value: "#34C38F" },
  { label: "Vàng", value: "#FACC15" },
  { label: "Cam", value: "#FB923C" },
  { label: "Đỏ", value: "#EF4444" },
  { label: "Hồng", value: "#EC4899" },
  { label: "Xám", value: "#64748B" },
];

export const colorPresets = NEURON_COLOR_PALETTE;
export const DEFAULT_NEURON_COLOR = "#20D6C7";

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
