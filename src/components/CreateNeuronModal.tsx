import { X } from "lucide-react";
import { useState } from "react";
import type { Neuron } from "../types";
import { colorPresets } from "../utils/neuron";

type CreateNeuronModalProps = {
  subjectId: string;
  onClose: () => void;
  onCreate: (neuron: Neuron) => void;
};

export function CreateNeuronModal({ subjectId, onClose, onCreate }: CreateNeuronModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(colorPresets[0].value);
  const [textContent, setTextContent] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [memoryMethod, setMemoryMethod] = useState("");
  const [application, setApplication] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [audio, setAudio] = useState<string[]>([]);

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const timestamp = new Date().toISOString();
    onCreate({
      id: `neuron-${crypto.randomUUID()}`,
      subjectId,
      name: trimmedName,
      color,
      position: {
        x: Math.random() * 4 - 2,
        y: Math.random() * 3 - 1.5,
        z: Math.random() * 4 - 2,
      },
      textContent,
      images,
      audio,
      keyPoints,
      memoryMethod,
      application,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  };

  const handleLocalFiles = (files: FileList | null, setter: (urls: string[]) => void) => {
    if (!files) return;
    setter(Array.from(files).map((file) => URL.createObjectURL(file)));
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section className="create-neuron-form">
        <div className="create-neuron-header sticky top-0 z-10 flex items-center justify-between">
          <h2 className="text-2xl font-extrabold text-slate-900">Tạo neuron</h2>
          <button onClick={onClose} className="rounded-md p-2 text-slate-600 transition hover:bg-slate-200" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="create-neuron-fields">
          <label className="block">
            <span className="create-neuron-label">Tên kiến thức</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="neuron-input"
              placeholder="Ví dụ: Chi phí cận biên"
            />
          </label>

          <div>
            <div className="create-neuron-label">Màu neuron</div>
            <div className="flex flex-wrap items-center gap-3">
              {colorPresets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setColor(preset.value)}
                  className={`neuron-color ${color === preset.value ? "is-selected" : ""}`}
                  style={{ backgroundColor: preset.value }}
                  aria-label={preset.label}
                  title={preset.label}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-8 w-12 cursor-pointer rounded-md border-2 border-slate-900 bg-white"
                aria-label="Chọn màu tùy chỉnh"
              />
            </div>
          </div>

          <Textarea label="Nội dung học" value={textContent} onChange={setTextContent} />
          <FileInput label="Hình ảnh" accept="image/*" onChange={(files) => handleLocalFiles(files, setImages)} />
          <FileInput label="Âm thanh" accept="audio/*" onChange={(files) => handleLocalFiles(files, setAudio)} />
          <Textarea label="Trọng tâm kiến thức" value={keyPoints} onChange={setKeyPoints} />
          <Textarea label="Cách ghi nhớ" value={memoryMethod} onChange={setMemoryMethod} />
          <Textarea label="Áp dụng" value={application} onChange={setApplication} />
        </div>

        <div className="create-neuron-footer sticky bottom-0 flex justify-end gap-3">
          <button onClick={onClose} className="neuron-modal-button">
            Hủy
          </button>
          <button onClick={handleSubmit} className="neuron-modal-button primary">
            Tạo neuron
          </button>
        </div>
      </section>
    </div>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="create-neuron-label">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="neuron-input neuron-textarea"
      />
    </label>
  );
}

function FileInput({ label, accept, onChange }: { label: string; accept: string; onChange: (files: FileList | null) => void }) {
  return (
    <label className="neuron-upload">
      <span className="create-neuron-label">{label}</span>
      <input type="file" accept={accept} multiple onChange={(event) => onChange(event.target.files)} className="block text-sm text-slate-500" />
    </label>
  );
}
