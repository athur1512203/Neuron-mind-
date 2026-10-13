import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { apiMessage } from "../api/client";
import type { Neuron } from "../types";
import { DEFAULT_NEURON_COLOR } from "../utils/neuron";
import { Button } from "./ui/Button";
import { NeuronColorPicker } from "./NeuronColorPicker";

function getInitialLayoutPosition(seed: string, isFirstNeuron: boolean) {
  if (isFirstNeuron) return { x: 0, y: 0, z: 0 };
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = hash >>> 0;
  return {
    x: ((normalized % 601) - 300) / 1000,
    y: (((normalized >>> 11) % 601) - 300) / 1000,
    z: (((normalized >>> 20) % 601) - 300) / 1000,
  };
}

type CreateNeuronModalProps = {
  subjectId: string;
  neuronCount: number;
  onClose: () => void;
  onCreate: (neuron: Neuron) => Promise<Neuron>;
};

export function CreateNeuronModal({ subjectId, neuronCount, onClose, onCreate }: CreateNeuronModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_NEURON_COLOR);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const handleSubmit = async () => {
    if (busy) return;
    const trimmedName = name.trim();
    if (!trimmedName) { setError("Tên neuron không được để trống."); return; }
    if (trimmedName.length > 120) { setError("Tên neuron tối đa 120 ký tự."); return; }

    setBusy(true);
    setError("");
    try {
      const timestamp = new Date().toISOString();
      await onCreate({
        id: "",
        subjectId,
        name: trimmedName,
        color,
        position: getInitialLayoutPosition(`${subjectId}:${trimmedName.toLowerCase()}`, neuronCount === 0),
        textContent: "",
        images: [],
        audio: [],
        keyPoints: "",
        memoryMethod: "",
        application: "",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      onClose();
    } catch (caught) {
      setError(apiMessage(caught, "Không tạo được neuron."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="nm-modal-overlay" onClick={() => { if (!busy) onClose(); }}>
      <section className="nm-modal nm-modal-sm nm-modal-create-neuron" onClick={(event) => event.stopPropagation()}>
        <header className="nm-modal-head">
          <div>
            <h2>Tạo neuron</h2>
            <p>Thêm neuron mới vào không gian</p>
          </div>
          <Button variant="icon" onClick={onClose} aria-label="Đóng" disabled={busy}><X size={18} /></Button>
        </header>

        <div className="nm-modal-body">
          <label className="nm-field">
            <span>Tên neuron</span>
            <input autoFocus value={name} disabled={busy} onChange={(event) => { setName(event.target.value); if (error) setError(""); }}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void handleSubmit(); } }}
              className="nm-input" placeholder="Nhập tên neuron..." maxLength={120} />
          </label>
          <div className="nm-field">
            <span>Màu neuron</span>
            <NeuronColorPicker value={color} onChange={setColor} disabled={busy} />
          </div>
          {error ? <p className="nm-modal-error" role="alert">{error}</p> : null}
        </div>

        <footer className="nm-modal-foot">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Hủy</Button>
          <Button variant="primary" onClick={() => void handleSubmit()} disabled={busy}>{busy ? "Đang tạo..." : "Tạo neuron"}</Button>
        </footer>
      </section>
    </div>
  );
}
