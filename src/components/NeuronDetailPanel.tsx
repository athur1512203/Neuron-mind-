import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Palette, Pencil, Trash2, X } from "lucide-react";
import { listDocuments, type DocumentMeta } from "../api/documents";
import { saveWorkingNote } from "../markdown/noteAutosave";
import { neuronMarkdownStore } from "../markdown/neuronMarkdownStore";
import type { Neuron, NeuronConnection } from "../types";
import { NeuronMarkdownEditor } from "./NeuronMarkdownEditor";
import { NeuronColorPicker } from "./NeuronColorPicker";
import { NeuronNameEditor } from "./NeuronNameEditor";
import { Button } from "./ui/Button";

export type DetailTab = "content" | "markdown" | "custom";
type Props = { neuron: Neuron; subjectId: string; connections: NeuronConnection[]; neurons: Neuron[]; connectionCount: number;
  onClose: () => void; onDelete: (neuronId: string) => Promise<void>; onUpdate: (neuron: Neuron) => void;
  onRename: (id: string, name: string) => Promise<void>; onSelectNeuron: (neuronId: string) => void;
  onColor: (id: string, color: string) => Promise<void>;
  onCreateConnection: (sourceId: string, targetId: string) => void | Promise<void>;
  onDeleteConnection: (connectionId: string) => void | Promise<void>; onToggleSidebar?: () => void; initialTab?: DetailTab };

export function NeuronDetailPanel({ neuron, subjectId, neurons, connections, onClose, onDelete, onRename, onColor, onSelectNeuron, onCreateConnection, onDeleteConnection }: Props) {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [customizeMode, setCustomizeMode] = useState<"menu" | "rename" | "color" | null>(null);
  const [draftColor, setDraftColor] = useState(neuron.color);
  const [colorBusy, setColorBusy] = useState(false);
  const [colorError, setColorError] = useState("");
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
      if (customizeMode) { if (!colorBusy) setCustomizeMode(null); return; }
      void closeSafely();
    };
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", escape); };
  }, [neuron.id, confirmDelete, deleting, customizeMode, colorBusy]);

  useEffect(() => {
    setCustomizeMode(null);
    setDraftColor(neuron.color);
    setColorError("");
  }, [neuron.id]);

  const saveColor = async () => {
    if (colorBusy) return;
    if (draftColor.toUpperCase() === neuron.color.toUpperCase()) { setCustomizeMode(null); return; }
    setColorBusy(true); setColorError("");
    try { await onColor(neuron.id, draftColor); setCustomizeMode(null); }
    catch { setColorError("Không đổi màu được neuron. Vui lòng thử lại."); }
    finally { setColorBusy(false); }
  };

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
          <NeuronNameEditor name={neuron.name} onSave={(name) => onRename(neuron.id, name)} editing={customizeMode === "rename"}
            onEditingChange={(editing) => setCustomizeMode(editing ? "rename" : null)} showEditButton={false} />
        </div>
        <div className="neuron-note-header-actions">
          <div className="neuron-customize-wrap">
            <Button variant="icon" onClick={() => setCustomizeMode((mode) => mode === "menu" ? null : "menu")} aria-label="Tùy chỉnh neuron" aria-expanded={customizeMode !== null}>
              <MoreHorizontal size={19} />
            </Button>
            {customizeMode === "menu" ? (
              <div className="neuron-customize-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => setCustomizeMode("rename")}><Pencil size={15} />Đổi tên</button>
                <button type="button" role="menuitem" onClick={() => { setDraftColor(neuron.color); setColorError(""); setCustomizeMode("color"); }}><Palette size={15} />Đổi màu</button>
              </div>
            ) : null}
            {customizeMode === "color" ? (
              <div className="neuron-color-popover" role="dialog" aria-label="Đổi màu neuron">
                <strong>Đổi màu</strong>
                <NeuronColorPicker value={draftColor} onChange={(color) => { setDraftColor(color); setColorError(""); }} disabled={colorBusy} includeDefault includeCustom />
                {colorError ? <p role="alert">{colorError}</p> : null}
                <div className="neuron-color-actions">
                  <Button variant="secondary" size="sm" disabled={colorBusy} onClick={() => setCustomizeMode(null)}>Hủy</Button>
                  <Button variant="primary" size="sm" disabled={colorBusy} onClick={() => void saveColor()}>{colorBusy ? "Đang lưu…" : "Lưu"}</Button>
                </div>
              </div>
            ) : null}
          </div>
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
