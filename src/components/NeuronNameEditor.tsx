import { Check, Pencil, X } from "lucide-react";
import { useRef, useState } from "react";

export function NeuronNameEditor({ name, onSave }: { name: string; onSave: (name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const cancel = () => { if (!pending.current) { setEditing(false); setError(""); } };
  const save = async () => {
    if (pending.current) return;
    const trimmed = value.trim();
    if (!trimmed) { setError("Tên neuron không được để trống."); return; }
    if (trimmed === name) { cancel(); return; }
    pending.current = true; setBusy(true); setError("");
    try { await onSave(trimmed); setEditing(false); }
    catch { setError("Không đổi tên được neuron. Vui lòng thử lại."); }
    finally { pending.current = false; setBusy(false); }
  };
  return <div className="nm-neuron-name">
    {editing ? <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <input autoFocus aria-label="Tên neuron" value={value} disabled={busy} aria-invalid={Boolean(error)}
        onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); cancel(); } }} />
      <button type="submit" disabled={busy} aria-label="Lưu tên neuron"><Check size={16} /></button>
      <button type="button" disabled={busy} aria-label="Hủy đổi tên" onClick={cancel}><X size={16} /></button>
    </form> : <div className="nm-neuron-name-row"><h2 className="truncate text-lg font-semibold text-[#191515]">{name}</h2>
      <button type="button" aria-label="Đổi tên neuron" onClick={() => { setValue(name); setEditing(true); }}><Pencil size={15} /></button></div>}
    {error && <p role="alert" className="nm-neuron-name-error">{error}</p>}
  </div>;
}
