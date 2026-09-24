import { Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Neuron, NeuronConnection } from "../types";

type ConnectionDetailPanelProps = {
  connection: NeuronConnection;
  source: Neuron;
  target: Neuron;
  onClose: () => void;
  onDelete: (connectionId: string) => void;
  onUpdate: (connection: NeuronConnection) => void;
};

export function ConnectionDetailPanel({ connection, source, target, onClose, onDelete, onUpdate }: ConnectionDetailPanelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(connection.explanation);

  const save = () => {
    onUpdate({ ...connection, explanation: draft.trim(), updatedAt: new Date().toISOString() });
    setEditing(false);
  };

  return (
    <aside className="h-full w-[420px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              {source.name} ↔ {target.name}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng panel">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="space-y-5 px-5 py-4">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-950">Liên kết như thế nào?</h3>
          {editing ? (
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={7}
              className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          ) : (
            <p className="text-sm leading-6 text-slate-600">{connection.explanation}</p>
          )}
        </section>

        <div className="flex gap-2">
          {editing ? (
            <button onClick={save} disabled={!draft.trim()} className="action-3d-button">
              <span className="btn-shadow" />
              <span className="btn-edge" />
              <span className="btn-front">Lưu</span>
            </button>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="action-3d-button"
            >
              <span className="btn-shadow" />
              <span className="btn-edge" />
              <span className="btn-front"><Pencil />Chỉnh sửa</span>
            </button>
          )}
          <button
            onClick={() => onDelete(connection.id)}
            className="action-3d-button danger"
          >
            <span className="btn-shadow" />
            <span className="btn-edge" />
            <span className="btn-front"><Trash2 />Xóa liên kết</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
