import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { listDocuments, type DocumentMeta } from "../api/documents";
import { saveWorkingNote } from "../markdown/noteAutosave";
import { neuronMarkdownStore } from "../markdown/neuronMarkdownStore";
import type { Neuron, NeuronConnection } from "../types";
import { NeuronMarkdownEditor } from "./NeuronMarkdownEditor";
import { Button } from "./ui/Button";

export type DetailTab = "content" | "markdown" | "custom";
type Props = { neuron: Neuron; subjectId: string; connections: NeuronConnection[]; neurons: Neuron[]; connectionCount: number;
  onClose: () => void; onDelete: (neuronId: string) => Promise<void>; onUpdate: (neuron: Neuron) => void;
  onRename: (id: string, name: string) => Promise<void>; onSelectNeuron: (neuronId: string) => void;
  onCreateConnection: (sourceId: string, targetId: string) => void | Promise<void>; onToggleSidebar?: () => void; initialTab?: DetailTab };

export function NeuronDetailPanel({ neuron, subjectId, neurons, connections, onClose, onSelectNeuron, onCreateConnection }: Props) {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  useEffect(() => {
    let active = true;
    listDocuments(subjectId).then((items) => { if (active) setDocuments(items); }).catch(() => { if (active) setDocuments([]); });
    return () => { active = false; };
  }, [subjectId]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") void closeSafely(); };
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", escape); };
  }, [neuron.id]);

  const closeSafely = async () => {
    if (neuronMarkdownStore.isDirty(neuron.id)) {
      try { await saveWorkingNote(neuron.id); } catch { /* Draft remains in the per-neuron store for retry. */ }
    }
    onClose();
  };

  const selectNeuronSafely = async (targetId: string) => {
    if (neuronMarkdownStore.isDirty(neuron.id)) {
      try { await saveWorkingNote(neuron.id); } catch { return; }
    }
    onSelectNeuron(targetId);
  };

  return createPortal(
    <section className="neuron-note-modal" role="dialog" aria-modal="true" aria-labelledby="neuron-note-title">
      <header className="neuron-note-header">
        <div className="neuron-note-title-wrap">
          <span className="nm-neuron-swatch" style={{ backgroundColor: neuron.color }} aria-hidden="true" />
          <h2 id="neuron-note-title">{neuron.name}</h2>
        </div>
        <Button variant="icon" onClick={() => void closeSafely()} aria-label="Đóng ghi chú"><X size={20} /></Button>
      </header>
      <NeuronMarkdownEditor key={neuron.id} neuronId={neuron.id} neurons={neurons} documents={documents} connections={connections}
        onEnsureConnection={(targetId) => onCreateConnection(neuron.id, targetId)} onSelectNeuron={(targetId) => void selectNeuronSafely(targetId)} />
    </section>,
    document.body,
  );
}
