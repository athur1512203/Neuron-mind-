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
  onCreate: (payload: { name: string; description: string; color: string }) => void;
};

export function CreateSubjectModal({ onClose, onCreate }: CreateSubjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(subjectColors[0].value);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Tên môn học không được để trống.");
      nameRef.current?.focus();
      return;
    }
    onCreate({ name: trimmedName, description: description.trim(), color });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <section
        className="w-full max-w-md rounded-xl border border-[#1f2a26] bg-[#0b1210] p-5 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-fancy text-2xl text-white">Tạo môn học mới</h2>
          <button onClick={onClose} className="rounded-md p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-300">Tên môn học *</span>
          <input
            ref={nameRef}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError("");
            }}
            className="w-full rounded-lg border border-[#2a3a34] bg-[#07110e] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
            placeholder="Ví dụ: Kinh tế vĩ mô"
          />
          {error ? <p className="mt-1.5 text-sm text-red-400">{error}</p> : null}
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-slate-300">Mô tả</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full resize-y rounded-lg border border-[#2a3a34] bg-[#07110e] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
            placeholder="Kiến thức và ghi chú môn Kinh tế vĩ mô."
          />
        </label>

        <div className="mt-4">
          <div className="mb-1.5 text-sm font-medium text-slate-300">Màu chủ đề *</div>
          <div className="flex flex-wrap gap-3">
            {subjectColors.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setColor(preset.value)}
                className={`h-8 w-8 rounded-full border-2 ${color === preset.value ? "border-white" : "border-transparent"}`}
                style={{ backgroundColor: preset.value, boxShadow: `0 0 10px ${preset.value}80` }}
                title={preset.label}
                aria-label={preset.label}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="action-3d-button secondary">
            <span className="btn-shadow" />
            <span className="btn-edge" />
            <span className="btn-front">Hủy</span>
          </button>
          <button onClick={handleSubmit} className="action-3d-button dashboard-add-button">
            <span className="btn-shadow" />
            <span className="btn-edge" />
            <span className="btn-front">Tạo môn học</span>
          </button>
        </div>
      </section>
    </div>
  );
}
