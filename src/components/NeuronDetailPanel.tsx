import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Palette, Pencil, Trash2, X } from "lucide-react";
import { apiMessage } from "../api/client";
import { listDocuments, type DocumentMeta } from "../api/documents";
import { createNeuronNote, deleteNote, listNeuronNotes, reorderNeuronNotes, updateNote, type NeuronNote } from "../api/markdownNotes";
import { saveWorkingNote } from "../markdown/noteAutosave";
import { neuronMarkdownStore } from "../markdown/neuronMarkdownStore";
import { getNeuronLinkIds } from "../markdown/documentEditor";
import type { Neuron, NeuronConnection } from "../types";
import { readActiveNote, rememberActiveNote } from "../utils/noteSelection";
import { NeuronMarkdownEditor } from "./NeuronMarkdownEditor";
import { NeuronColorPicker } from "./NeuronColorPicker";
import { NeuronNameEditor } from "./NeuronNameEditor";
import { NeuronNoteTabs } from "./NeuronNoteTabs";
import { Button } from "./ui/Button";

export type DetailTab = "content" | "markdown" | "custom";
type Props = { neuron: Neuron; subjectId: string; connections: NeuronConnection[]; neurons: Neuron[]; connectionCount: number;
  onClose: () => void; onDelete: (neuronId: string) => Promise<void>; onUpdate: (neuron: Neuron) => void;
  onRename: (id: string, name: string) => Promise<void>; onSelectNeuron: (neuronId: string) => void;
  onColor: (id: string, color: string) => Promise<void>;
  onCreateConnection: (sourceId: string, targetId: string) => void | Promise<void>;
  onDeleteConnection: (connectionId: string) => void | Promise<void>; onToggleSidebar?: () => void; initialTab?: DetailTab };

export function NeuronDetailPanel({ neuron, subjectId, neurons, connections, onClose, onDelete, onRename, onColor, onSelectNeuron, onCreateConnection }: Props) {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [notes, setNotes] = useState<NeuronNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [notesBusy, setNotesBusy] = useState(false);
  const [notesError, setNotesError] = useState("");
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
    let active = true; const controller = new AbortController();
    setNotes([]); setActiveNoteId(null); setNotesError("");
    void listNeuronNotes(neuron.id, controller.signal).then((items) => {
      if (!active) return;
      setNotes(items);
      const remembered = readActiveNote(neuron.id);
      const selected = items.find((item) => item.id === remembered) ?? items.find((item) => Boolean(item.isDefault)) ?? items[0];
      if (selected) { setActiveNoteId(selected.id); rememberActiveNote(neuron.id, selected.id); }
    }).catch((error) => { if (active && !(error instanceof DOMException && error.name === "AbortError")) setNotesError(apiMessage(error, "Không tải được danh sách Note.")); });
    return () => { active = false; controller.abort(); };
  }, [neuron.id]);

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
  }, [neuron.id, activeNoteId, confirmDelete, deleting, customizeMode, colorBusy]);

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

  const flushActiveNote = async () => {
    if (!activeNoteId) return;
    if (neuronMarkdownStore.isDirty(activeNoteId)) await saveWorkingNote(activeNoteId);
    const linkedNeuronIds = getNeuronLinkIds(neuronMarkdownStore.getSaved(activeNoteId));
    await Promise.all([...linkedNeuronIds].map((targetId) => onCreateConnection(neuron.id, targetId)));
  };

  const closeSafely = async () => {
    try { await flushActiveNote(); } catch { /* Draft remains in the per-note store for retry. */ }
    onClose();
  };

  const selectNeuronSafely = async (targetId: string) => {
    try { await flushActiveNote(); } catch { return; }
    onSelectNeuron(targetId);
  };

  const deleteNeuron = async () => {
    if (deleting) return;
    setDeleting(true); setDeleteError("");
    const snapshots = new Map(notes.map((note) => [note.id, neuronMarkdownStore.discardForDeletion(note.id)]));
    try {
      await onDelete(neuron.id);
      onClose();
    } catch (error) {
      snapshots.forEach((snapshot, noteId) => {
        neuronMarkdownStore.restoreAfterFailedDeletion(noteId, snapshot);
        if (neuronMarkdownStore.isDirty(noteId)) void saveWorkingNote(noteId).catch(() => {});
      });
      setDeleteError(error instanceof Error ? error.message : "Không xóa được neuron. Vui lòng thử lại.");
      setDeleting(false);
    }
  };

  const switchNote = async (noteId: string) => {
    if (noteId === activeNoteId || notesBusy) return;
    setNotesBusy(true); setNotesError("");
    try {
      await flushActiveNote();
      setActiveNoteId(noteId); rememberActiveNote(neuron.id, noteId);
    } catch (error) { setNotesError(apiMessage(error, "Không lưu được Note hiện tại nên chưa thể chuyển tab.")); }
    finally { setNotesBusy(false); }
  };

  const createNote = async () => {
    if (notesBusy) return;
    setNotesBusy(true); setNotesError("");
    try {
      await flushActiveNote();
      const created = await createNeuronNote(neuron.id);
      setNotes((current) => [...current, created]);
      setActiveNoteId(created.id); rememberActiveNote(neuron.id, created.id);
    } catch (error) { setNotesError(apiMessage(error, "Không tạo được Note.")); }
    finally { setNotesBusy(false); }
  };

  const renameNote = async (noteId: string, name: string) => {
    const saved = await updateNote(noteId, { name });
    setNotes((current) => current.map((note) => note.id === noteId ? { ...note, name: saved.name, updatedAt: saved.updatedAt } : note));
  };

  const moveNote = async (noteId: string, direction: -1 | 1) => {
    if (notesBusy) return;
    const index = notes.findIndex((note) => note.id === noteId), targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= notes.length) return;
    setNotesBusy(true); setNotesError("");
    try {
      const next = [...notes], item = next[index]; next[index] = next[targetIndex]; next[targetIndex] = item;
      await reorderNeuronNotes(neuron.id, next.map((note) => note.id));
      setNotes(next.map((note, sortOrder) => ({ ...note, sortOrder })));
    } catch (error) { setNotesError(apiMessage(error, "Không sắp xếp được Note.")); }
    finally { setNotesBusy(false); }
  };

  const removeNote = async (noteId: string) => {
    const target = notes.find((note) => note.id === noteId);
    if (!target || notes.length <= 1 || notesBusy || !window.confirm(`Xóa Note “${target.name}”? Nội dung Note này sẽ bị xóa.`)) return;
    setNotesBusy(true); setNotesError("");
    const snapshot = neuronMarkdownStore.discardForDeletion(noteId);
    try {
      await deleteNote(noteId);
      const remaining = notes.filter((note) => note.id !== noteId);
      setNotes(remaining);
      if (activeNoteId === noteId) {
        const next = remaining[Math.max(0, notes.findIndex((note) => note.id === noteId) - 1)] ?? remaining[0];
        setActiveNoteId(next.id); rememberActiveNote(neuron.id, next.id);
      }
    } catch (error) {
      neuronMarkdownStore.restoreAfterFailedDeletion(noteId, snapshot);
      setNotesError(apiMessage(error, "Không xóa được Note."));
    } finally { setNotesBusy(false); }
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
      <NeuronNoteTabs notes={notes} activeNoteId={activeNoteId} busy={notesBusy} onSelect={(noteId) => void switchNote(noteId)}
        onCreate={() => void createNote()} onRename={renameNote} onDelete={(noteId) => void removeNote(noteId)} onMove={(noteId, direction) => void moveNote(noteId, direction)} />
      {notesError ? <div className="neuron-note-tabs-banner" role="alert">{notesError}</div> : null}
      {activeNoteId ? (
        <NeuronMarkdownEditor key={activeNoteId} noteId={activeNoteId} neuronId={neuron.id} neurons={neurons} documents={documents} connections={connections}
          onEnsureConnection={(targetId) => onCreateConnection(neuron.id, targetId)} onSelectNeuron={(targetId) => void selectNeuronSafely(targetId)} />
      ) : <div className="neuron-note-loading">{notesError ? "Không thể mở Note." : "Đang tải Note…"}</div>}
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
