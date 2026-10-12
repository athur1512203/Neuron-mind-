import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";
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
  onCreateConnection: (sourceId: string, targetId: string) => void | Promise<void>;
  onDeleteConnection: (connectionId: string) => void | Promise<void>; onToggleSidebar?: () => void; initialTab?: DetailTab };

export function NeuronDetailPanel({ neuron, subjectId, neurons, connections, onClose, onDelete, onSelectNeuron, onCreateConnection, onDeleteConnection }: Props) {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  useEffect(() => {
    let active = true;
    listDocuments(subjectId).then((items) => { if (active) setDocuments(items); }).catch(() => { if (active) setDocuments([]); });
    return () => { active = false; };
  }, [subjectId]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (confirmDelete) { if (!deleting) setConfirmDelete(false); return; }
      void closeSafely();
    };
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", escape); };
  }, [neuron.id, confirmDelete, deleting]);

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

  const deleteNeuron = async () => {
    if (deleting) return;
    setDeleting(true); setDeleteError("");
    const snapshot = neuronMarkdownStore.discardForDeletion(neuron.id);
    try {
      await onDelete(neuron.id);
      onClose();
    } catch (error) {
      neuronMarkdownStore.restoreAfterFailedDeletion(neuron.id, snapshot);
      void saveWorkingNote(neuron.id).catch(() => {});
      setDeleteError(error instanceof Error ? error.message : "Không xóa được neuron. Vui lòng thử lại.");
      setDeleting(false);
    }
  };

  return createPortal(
    <section className="neuron-note-modal" role="dialog" aria-modal="true" aria-labelledby="neuron-note-title">
      <header className="neuron-note-header">
        <div className="neuron-note-title-wrap">
          <span className="nm-neuron-swatch" style={{ backgroundColor: neuron.color }} aria-hidden="true" />
          <h2 id="neuron-note-title">{neuron.name}</h2>
        </div>
        <div className="neuron-note-header-actions">
          <Button variant="danger" size="sm" onClick={() => { setDeleteError(""); setConfirmDelete(true); }} aria-label={`Xóa neuron ${neuron.name}`}>
            <Trash2 size={16} /> Xóa
          </Button>
          <Button variant="icon" onClick={() => void closeSafely()} aria-label="Đóng ghi chú"><X size={20} /></Button>
        </div>
      </header>
      <NeuronMarkdownEditor key={neuron.id} neuronId={neuron.id} neurons={neurons} documents={documents} connections={connections}
        onEnsureConnection={(targetId) => onCreateConnection(neuron.id, targetId)} onDeleteConnection={onDeleteConnection}
        onSelectNeuron={(targetId) => void selectNeuronSafely(targetId)} />
      {confirmDelete ? (
        <div className="neuron-note-delete-overlay" role="presentation" onMouseDown={() => { if (!deleting) setConfirmDelete(false); }}>
          <section className="nm-modal nm-modal-sm neuron-note-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-neuron-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="nm-modal-head">
              <div>
                <h2 id="delete-neuron-title">Xóa neuron?</h2>
                <p>Bạn có chắc chắn muốn xóa neuron &apos;{neuron.name}&apos; không? Hành động này không thể hoàn tác.</p>
              </div>
            </header>
            {deleteError ? <p className="nm-modal-error neuron-note-delete-error" role="alert">{deleteError}</p> : null}
            <footer className="nm-modal-foot">
              <Button variant="secondary" disabled={deleting} onClick={() => setConfirmDelete(false)}>Hủy</Button>
              <Button variant="danger" disabled={deleting} onClick={() => void deleteNeuron()}>
                <Trash2 size={16} /> {deleting ? "Đang xóa…" : "Xóa neuron"}
              </Button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>,
    document.body,
  );
}
