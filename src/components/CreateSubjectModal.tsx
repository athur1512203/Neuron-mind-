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
  onCreate: (payload: { name: string; color: string }) => void | Promise<void>;
};

export function CreateSubjectModal({ onClose, onCreate }: CreateSubjectModalProps) {
  const [name, setName] = useState("");
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
      await onCreate({ name: trimmedName, color });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tạo được không gian.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="nm-modal-overlay" onClick={onClose}>
      <section className="nm-modal nm-modal-sm" onClick={(event) => event.stopPropagation()}>
        <header className="nm-modal-head">
          <div>
            <h2>Tạo không gian mới</h2>
            <p>Tạo một khu vực riêng để tổ chức các neuron.</p>
          </div>
          <button type="button" onClick={onClose} className="gs-close" aria-label="Đóng">
            <X size={18} />
          </button>
        </header>

        <div className="nm-modal-body">
          <label className="nm-field">
            <span>Tên không gian</span>
            <input
              ref={nameRef}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError("");
              }}
              className="nm-input"
              placeholder="Ví dụ: Công việc, Học tập, Dự án cá nhân..."
            />
            {error ? <p className="nm-modal-error">{error}</p> : null}
          </label>

          <div className="nm-field">
            <span>Màu chủ đề</span>
            <div className="nm-swatches">
              {subjectColors.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setColor(preset.value)}
                  className={`nm-swatch ${color === preset.value ? "is-on" : ""}`}
                  style={{ backgroundColor: preset.value }}
                  title={preset.label}
                  aria-label={preset.label}
                />
              ))}
            </div>
          </div>
        </div>

        <footer className="nm-modal-foot">
          <button type="button" onClick={onClose} className="nm-btn nm-btn-secondary">Hủy</button>
          <button type="button" onClick={handleSubmit} disabled={busy} className="nm-btn nm-btn-primary">
            {busy ? "Đang tạo..." : "Tạo không gian"}
          </button>
        </footer>
      </section>
    </div>
  );
}
