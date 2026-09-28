import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const subjectColors = [
  { label: "Xanh lá", value: "#22c55e" },
  { label: "Xanh dương", value: "#3b82f6" },
  { label: "Tím", value: "#a855f7" },
  { label: "Cam", value: "#f97316" },
  { label: "Đỏ", value: "#ef4444" },
  { label: "Cyan", value: "#06b6d4" },
];

type CreateSubjectModalProps = {
  onClose: () => void;
  onCreate: (payload: { name: string; description: string; color: string }) => void | Promise<void>;
};

export function CreateSubjectModal({ onClose, onCreate }: CreateSubjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(subjectColors[0].value);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Tên không gian không được để trống.");
      nameRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await onCreate({ name: trimmedName, description: description.trim(), color });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tạo được không gian.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="create-subject-overlay fixed inset-0 z-50 grid place-items-center p-4" onClick={onClose}>
      <section className="create-subject-modal" onClick={(event) => event.stopPropagation()}>
        <div className="create-subject-header flex items-center justify-between">
          <h2 className="create-subject-title">Tạo không gian mới</h2>
          <button onClick={onClose} className="create-subject-close" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <label className="block">
          <span className="create-subject-label">Tên không gian *</span>
          <input
            ref={nameRef}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError("");
            }}
            className="create-subject-field create-subject-input"
            placeholder="Ví dụ: Công việc, TMU, Dự án XMP..."
          />
          {error ? <p className="mt-1.5 text-sm font-semibold text-red-700">{error}</p> : null}
        </label>

        <label className="mt-4 block">
          <span className="create-subject-label">Mô tả</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="create-subject-field create-subject-textarea"
            placeholder="Mô tả ngắn về không gian này..."
          />
        </label>

        <div className="mt-4">
          <div className="create-subject-label">Màu chủ đề *</div>
          <div className="flex flex-wrap gap-3">
            {subjectColors.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setColor(preset.value)}
                className={`create-subject-swatch ${color === preset.value ? "is-selected" : ""}`}
                style={{ backgroundColor: preset.value }}
                title={preset.label}
                aria-label={preset.label}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="create-subject-btn create-subject-btn-cancel">
            Hủy
          </button>
          <button type="button" onClick={handleSubmit} disabled={busy} className="create-subject-btn create-subject-btn-submit">
            {busy ? "Đang tạo..." : "Tạo không gian"}
          </button>
        </div>
      </section>
    </div>
  );
}
