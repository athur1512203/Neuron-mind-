import { ChevronLeft, ChevronRight, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { NeuronNote } from "../api/markdownNotes";

type Props = {
  notes: NeuronNote[];
  activeNoteId: string | null;
  busy?: boolean;
  onSelect: (noteId: string) => void;
  onCreate: () => void;
  onRename: (noteId: string, name: string) => Promise<void>;
  onDelete: (noteId: string) => void;
  onMove: (noteId: string, direction: -1 | 1) => void;
};

export function NeuronNoteTabs({ notes, activeNoteId, busy, onSelect, onCreate, onRename, onDelete, onMove }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = Array.from(rowRef.current?.children ?? []).find((element) => (element as HTMLElement).dataset.noteId === activeNoteId) as HTMLElement | undefined;
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeNoteId]);

  const beginRename = (note: NeuronNote) => { setMenu(null); setEditingId(note.id); setName(note.name); setError(""); };
  const saveRename = async (note: NeuronNote) => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Tên Note không được để trống."); return; }
    if (trimmed === note.name) { setEditingId(null); return; }
    try { await onRename(note.id, trimmed); setEditingId(null); setError(""); }
    catch { setError("Không đổi tên được Note."); }
  };

  return (
    <div className="neuron-note-tabs-shell">
      <div ref={rowRef} className="neuron-note-tabs" role="tablist" aria-label="Danh sách Note">
        {notes.map((note, index) => (
          <div key={note.id} className={`neuron-note-tab-wrap ${note.id === activeNoteId ? "is-active" : ""}`} data-note-id={note.id}>
            {editingId === note.id ? (
              <form className="neuron-note-tab-rename" onSubmit={(event) => { event.preventDefault(); void saveRename(note); }}>
                <input autoFocus value={name} maxLength={120} disabled={busy} aria-label="Tên Note"
                  onChange={(event) => { setName(event.target.value); setError(""); }}
                  onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setEditingId(null); setError(""); } }} />
                <button type="submit" disabled={busy}>Lưu</button>
                <button type="button" disabled={busy} onClick={() => setEditingId(null)}>Hủy</button>
              </form>
            ) : (
              <>
                <button type="button" role="tab" aria-selected={note.id === activeNoteId} className="neuron-note-tab"
                  disabled={busy} onClick={() => onSelect(note.id)} onDoubleClick={() => beginRename(note)}>
                  {note.name}
                </button>
                <button type="button" className="neuron-note-tab-menu-button" disabled={busy} aria-label={`Tùy chọn ${note.name}`}
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMenu((current) => current?.id === note.id ? null : { id: note.id, top: rect.bottom + 5, left: Math.max(8, Math.min(window.innerWidth - 162, rect.right - 154)) });
                  }}><MoreHorizontal size={14} /></button>
                {menu?.id === note.id ? (
                  <div className="neuron-note-tab-menu" role="menu" style={{ top: menu.top, left: menu.left }}>
                    <button type="button" onClick={() => beginRename(note)}>Đổi tên</button>
                    <button type="button" disabled={index === 0} onClick={() => { setMenu(null); onMove(note.id, -1); }}><ChevronLeft size={14} />Sang trái</button>
                    <button type="button" disabled={index === notes.length - 1} onClick={() => { setMenu(null); onMove(note.id, 1); }}><ChevronRight size={14} />Sang phải</button>
                    <button type="button" className="is-danger" disabled={notes.length === 1} onClick={() => { setMenu(null); onDelete(note.id); }}><Trash2 size={14} />Xóa Note</button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ))}
        <button type="button" className="neuron-note-add" disabled={busy} onClick={onCreate} aria-label="Tạo Note mới"><Plus size={17} /></button>
      </div>
      {error ? <p className="neuron-note-tabs-error" role="alert">{error}</p> : null}
    </div>
  );
}
