export type NeuronMarkdownStore = {
  getSaved(neuronId: string): string;
  getWorking(neuronId: string): string;
  isDirty(neuronId: string): boolean;
  setWorking(neuronId: string, markdown: string): void;
  applyServer(neuronId: string, markdown: string): boolean;
  commit(neuronId: string, markdown: string): void;
  acknowledge(neuronId: string, markdown: string): void;
  discardForDeletion(neuronId: string): NeuronNoteSnapshot;
  restoreAfterFailedDeletion(neuronId: string, snapshot: NeuronNoteSnapshot): void;
  isDiscarded(neuronId: string): boolean;
};

export type NeuronNoteSnapshot = { saved?: string; working?: string };

const savedByNeuronId = new Map<string, string>();
const workingByNeuronId = new Map<string, string>();
const discardedNeuronIds = new Set<string>();

export const neuronMarkdownStore: NeuronMarkdownStore = {
  getSaved(neuronId) {
    return savedByNeuronId.get(neuronId) ?? "";
  },
  getWorking(neuronId) {
    return workingByNeuronId.get(neuronId) ?? savedByNeuronId.get(neuronId) ?? "";
  },
  isDirty(neuronId) {
    if (discardedNeuronIds.has(neuronId)) return false;
    if (!workingByNeuronId.has(neuronId)) return false;
    return workingByNeuronId.get(neuronId) !== (savedByNeuronId.get(neuronId) ?? "");
  },
  setWorking(neuronId, markdown) {
    if (discardedNeuronIds.has(neuronId)) return;
    workingByNeuronId.set(neuronId, markdown);
  },
  applyServer(neuronId, markdown) {
    if (discardedNeuronIds.has(neuronId)) return false;
    if (neuronMarkdownStore.isDirty(neuronId)) return false;
    savedByNeuronId.set(neuronId, markdown);
    workingByNeuronId.set(neuronId, markdown);
    return true;
  },
  commit(neuronId, markdown) {
    if (discardedNeuronIds.has(neuronId)) return;
    savedByNeuronId.set(neuronId, markdown);
    workingByNeuronId.set(neuronId, markdown);
  },
  acknowledge(neuronId, markdown) {
    if (discardedNeuronIds.has(neuronId)) return;
    savedByNeuronId.set(neuronId, markdown);
    if (!workingByNeuronId.has(neuronId)) workingByNeuronId.set(neuronId, markdown);
  },
  discardForDeletion(neuronId) {
    const snapshot = { saved: savedByNeuronId.get(neuronId), working: workingByNeuronId.get(neuronId) };
    discardedNeuronIds.add(neuronId);
    savedByNeuronId.delete(neuronId);
    workingByNeuronId.delete(neuronId);
    return snapshot;
  },
  restoreAfterFailedDeletion(neuronId, snapshot) {
    discardedNeuronIds.delete(neuronId);
    if (snapshot.saved !== undefined) savedByNeuronId.set(neuronId, snapshot.saved);
    if (snapshot.working !== undefined) workingByNeuronId.set(neuronId, snapshot.working);
  },
  isDiscarded(neuronId) {
    return discardedNeuronIds.has(neuronId);
  },
};
