import { X } from "lucide-react";
import { useState } from "react";
import type { Neuron } from "../types";

type CreateConnectionModalProps = {
  source: Neuron;
  target: Neuron;
  onCancel: () => void;
  onCreate: (explanation: string) => void;
};

export function CreateConnectionModal({ source, target, onCancel, onCreate }: CreateConnectionModalProps) {
  const [explanation, setExplanation] = useState("");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section className="w-full max-w-xl rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-950">Tạo liên kết</h2>
          <button onClick={onCancel} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="app-card p-4 text-center text-sm font-medium text-slate-200">
            <span>{source.name}</span>
            <div className="py-2 text-slate-400">↓</div>
            <span>{target.name}</span>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Hai kiến thức này liên kết như thế nào?</span>
            <textarea
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              rows={5}
              className="mt-2 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Giải thích tại sao hai kiến thức này có liên quan..."
            />
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button onClick={onCancel} className="action-3d-button secondary">
            <span className="btn-shadow" />
            <span className="btn-edge" />
            <span className="btn-front">Hủy</span>
          </button>
          <button
            onClick={() => explanation.trim() && onCreate(explanation.trim())}
            className="action-3d-button"
            disabled={!explanation.trim()}
          >
            <span className="btn-shadow" />
            <span className="btn-edge" />
            <span className="btn-front">Tạo liên kết</span>
          </button>
        </div>
      </section>
    </div>
  );
}
