export type NeuronMarkdownStore = {
  get(neuronId: string): string;
  set(neuronId: string, markdown: string): void;
};

const markdownByNeuronId = new Map<string, string>();

export const neuronMarkdownStore: NeuronMarkdownStore = {
  get(neuronId) {
    return markdownByNeuronId.get(neuronId) ?? "";
  },
  set(neuronId, markdown) {
    markdownByNeuronId.set(neuronId, markdown);
  },
};
