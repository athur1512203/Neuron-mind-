export type NeuronMarkdownStore = {
  getSaved(neuronId: string): string;
  getWorking(neuronId: string): string;
  isDirty(neuronId: string): boolean;
  setWorking(neuronId: string, markdown: string): void;
  applyServer(neuronId: string, markdown: string): boolean;
  commit(neuronId: string, markdown: string): void;
  acknowledge(neuronId: string, markdown: string): void;
};

const savedByNeuronId = new Map<string, string>();
const workingByNeuronId = new Map<string, string>();

export const neuronMarkdownStore: NeuronMarkdownStore = {
  getSaved(neuronId) {
    return savedByNeuronId.get(neuronId) ?? "";
  },
  getWorking(neuronId) {
    return workingByNeuronId.get(neuronId) ?? savedByNeuronId.get(neuronId) ?? "";
  },
  isDirty(neuronId) {
    if (!workingByNeuronId.has(neuronId)) return false;
    return workingByNeuronId.get(neuronId) !== (savedByNeuronId.get(neuronId) ?? "");
  },
  setWorking(neuronId, markdown) {
    workingByNeuronId.set(neuronId, markdown);
  },
  applyServer(neuronId, markdown) {
    if (neuronMarkdownStore.isDirty(neuronId)) return false;
    savedByNeuronId.set(neuronId, markdown);
    workingByNeuronId.set(neuronId, markdown);
    return true;
  },
  commit(neuronId, markdown) {
    savedByNeuronId.set(neuronId, markdown);
    workingByNeuronId.set(neuronId, markdown);
  },
  acknowledge(neuronId, markdown) {
    savedByNeuronId.set(neuronId, markdown);
    if (!workingByNeuronId.has(neuronId)) workingByNeuronId.set(neuronId, markdown);
  },
};
