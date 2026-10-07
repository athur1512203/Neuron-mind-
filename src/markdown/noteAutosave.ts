import { saveNeuronMarkdown } from "../api/markdownNotes";
import { neuronMarkdownStore } from "./neuronMarkdownStore";

/** One write lane per Neuron, shared across editor mounts. Never abort an in-flight write. */
export function createNoteSaver(write: (id: string, content: string) => Promise<unknown>, store = neuronMarkdownStore) {
  const lanes = new Map<string, Promise<string>>();
  return (id: string): Promise<string> => {
    const existing = lanes.get(id);
    if (existing) return existing;
    const run = async () => {
      while (store.isDirty(id)) {
        const snapshot = store.getWorking(id);
        await write(id, snapshot);
        // Newer drafts remain intact; write them only after the previous request finishes.
        store.acknowledge(id, snapshot);
      }
      return store.getSaved(id);
    };
    const result = run().finally(() => { if (lanes.get(id) === result) lanes.delete(id); });
    lanes.set(id, result); return result;
  };
}
export const saveWorkingNote = createNoteSaver(saveNeuronMarkdown);
