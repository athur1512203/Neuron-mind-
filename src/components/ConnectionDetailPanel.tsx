import { Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Neuron, NeuronConnection } from "../types";
import { Button } from "./ui/Button";

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
          <Button variant="icon" onClick={onClose} aria-label="Đóng panel">
            <X size={18} />
          </Button>
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
            <Button variant="primary" onClick={save} disabled={!draft.trim()}>
              Lưu
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setEditing(true)}>
              <Pencil />Chỉnh sửa
            </Button>
          )}
          <Button variant="danger" onClick={() => onDelete(connection.id)}>
            <Trash2 />Xóa liên kết
          </Button>
        </div>
      </div>
    </aside>
  );
}
