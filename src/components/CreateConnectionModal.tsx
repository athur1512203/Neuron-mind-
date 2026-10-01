import { X } from "lucide-react";
import { useState } from "react";
import type { Neuron } from "../types";
import { Button } from "./ui/Button";

type CreateConnectionModalProps = {
  source: Neuron;
  target: Neuron;
  onCancel: () => void;
  onCreate: (explanation: string) => void | Promise<void>;
};

export function CreateConnectionModal({ source, target, onCancel, onCreate }: CreateConnectionModalProps) {
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section className="w-full max-w-xl rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-950">Tạo liên kết</h2>
          <Button variant="icon" onClick={onCancel} aria-label="Đóng">
            <X size={18} />
          </Button>
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
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <Button variant="secondary" onClick={onCancel}>
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (!explanation.trim()) return;
              setBusy(true);
              setError("");
              try {
                await onCreate(explanation.trim());
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Không tạo được liên kết.");
              } finally {
                setBusy(false);
              }
            }}
            disabled={!explanation.trim() || busy}
          >
            {busy ? "Đang tạo..." : "Tạo liên kết"}
          </Button>
        </div>
      </section>
    </div>
  );
}
