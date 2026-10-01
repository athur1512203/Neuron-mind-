import { Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Neuron } from "../types";
import { colorPresets } from "../utils/neuron";

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
  onCreate: (neuron: Neuron) => void | Promise<void>;
};

export function CreateNeuronModal({ subjectId, neuronCount, onClose, onCreate }: CreateNeuronModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(colorPresets[0].value);
  const [textContent, setTextContent] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [memoryMethod, setMemoryMethod] = useState("");
  const [application, setApplication] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [audio, setAudio] = useState<string[]>([]);
  const [imageNames, setImageNames] = useState<string[]>([]);
  const [audioNames, setAudioNames] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const timestamp = new Date().toISOString();
    setBusy(true);
    setError("");
    try {
      await onCreate({
        id: "",
        subjectId,
        name: trimmedName,
        color,
        position: getInitialLayoutPosition(`${subjectId}:${trimmedName.toLowerCase()}`, neuronCount === 0),
        textContent,
        images,
        audio,
        keyPoints,
        memoryMethod,
        application,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tạo được neuron.");
    } finally {
      setBusy(false);
    }
  };

  const handleLocalFiles = (files: FileList | null, setter: (urls: string[]) => void, names: (list: string[]) => void) => {
    if (!files) return;
    setter(Array.from(files).map((file) => URL.createObjectURL(file)));
    names(Array.from(files).map((file) => file.name));
  };

  return (
    <div className="nm-modal-overlay" onClick={onClose}>
      <section className="nm-modal nm-modal-lg" onClick={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
        <header className="nm-modal-head">
          <div>
            <h2>Tạo neuron</h2>
            <p>Thêm một kiến thức mới vào không gian.</p>
          </div>
          <button type="button" onClick={onClose} className="gs-close" aria-label="Đóng">
            <X size={18} />
          </button>
        </header>

        <div className="nm-modal-body">
          <label className="nm-field">
            <span>Tên kiến thức</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="nm-input"
              placeholder="Ví dụ: Chi phí cận biên"
            />
          </label>

          <div className="nm-field">
            <span>Màu neuron</span>
            <div className="nm-swatches">
              {colorPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setColor(preset.value)}
                  className={`nm-swatch ${color === preset.value ? "is-on" : ""}`}
                  style={{ backgroundColor: preset.value }}
                  aria-label={preset.label}
                  title={preset.label}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="nm-swatch-custom"
                aria-label="Chọn màu tùy chỉnh"
              />
            </div>
          </div>

          <Textarea label="Nội dung học" value={textContent} onChange={setTextContent} />
          <FileDrop
            label="Hình ảnh"
            hint="Chọn hình ảnh"
            detail="PNG, JPG..."
            accept="image/*"
            names={imageNames}
            onChange={(files) => handleLocalFiles(files, setImages, setImageNames)}
          />
          <FileDrop
            label="Âm thanh"
            hint="Chọn tệp âm thanh"
            detail=""
            accept="audio/*"
            names={audioNames}
            onChange={(files) => handleLocalFiles(files, setAudio, setAudioNames)}
          />
          <Textarea label="Trọng tâm kiến thức" value={keyPoints} onChange={setKeyPoints} />
          <Textarea label="Cách ghi nhớ" value={memoryMethod} onChange={setMemoryMethod} />
          <Textarea label="Áp dụng" value={application} onChange={setApplication} />
          {error ? <p className="nm-modal-error">{error}</p> : null}
        </div>

        <footer className="nm-modal-foot">
          <button type="button" onClick={onClose} className="nm-btn nm-btn-secondary">Hủy</button>
          <button type="button" onClick={handleSubmit} disabled={busy} className="nm-btn nm-btn-primary">
            {busy ? "Đang tạo..." : "Tạo neuron"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="nm-field">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="nm-input nm-textarea" />
    </label>
  );
}

function FileDrop({
  label,
  hint,
  detail,
  accept,
  names,
  onChange,
}: {
  label: string;
  hint: string;
  detail: string;
  accept: string;
  names: string[];
  onChange: (files: FileList | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="nm-field">
      <span>{label}</span>
      <button type="button" className="nm-drop" onClick={() => inputRef.current?.click()}>
        <Upload size={18} />
        <strong>{hint}</strong>
        {detail ? <small>{detail}</small> : null}
        {names.length ? <em>{names.join(", ")}</em> : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="sr-only"
        onChange={(event) => onChange(event.target.files)}
      />
    </div>
  );
}
