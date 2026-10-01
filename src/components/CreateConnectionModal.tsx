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
    <div className="nm-modal-overlay">
      <section className="nm-modal nm-modal-sm" onClick={(event) => event.stopPropagation()}>
        <header className="nm-modal-head">
          <div>
            <h2>Tạo liên kết</h2>
          </div>
          <Button variant="icon" onClick={onCancel} aria-label="Đóng">
            <X size={18} />
          </Button>
        </header>

        <div className="nm-modal-body">
          <div className="nm-field">
            <span>{source.name}</span>
            <p className="nm-field-hint">↓</p>
            <span>{target.name}</span>
          </div>

          <label className="nm-field">
            <span>Hai kiến thức này liên kết như thế nào?</span>
            <textarea
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              rows={5}
              className="nm-textarea"
              placeholder="Giải thích tại sao hai kiến thức này có liên quan..."
            />
          </label>
          {error ? <p className="nm-modal-error">{error}</p> : null}
        </div>

        <footer className="nm-modal-foot">
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
        </footer>
      </section>
    </div>
  );
}
