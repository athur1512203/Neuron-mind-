import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = { name: string; onSave: (name: string) => Promise<void>; editing?: boolean; onEditingChange?: (editing: boolean) => void; showEditButton?: boolean };

export function NeuronNameEditor({ name, onSave, editing: controlledEditing, onEditingChange, showEditButton = true }: Props) {
  const [localEditing, setLocalEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const editing = controlledEditing ?? localEditing;
  const setEditing = (next: boolean) => { if (controlledEditing === undefined) setLocalEditing(next); onEditingChange?.(next); };
  useEffect(() => { if (!editing) setValue(name); }, [editing, name]);
  const cancel = () => { if (!pending.current) { setValue(name); setEditing(false); setError(""); } };
  const save = async () => {
    if (pending.current) return;
    const trimmed = value.trim();
    if (!trimmed) { setError("Tên neuron không được để trống."); return; }
    if (trimmed.length > 120) { setError("Tên neuron tối đa 120 ký tự."); return; }
    if (trimmed === name) { cancel(); return; }
    pending.current = true; setBusy(true); setError("");
    try { await onSave(trimmed); setEditing(false); }
    catch { setError("Không đổi tên được neuron. Vui lòng thử lại."); }
    finally { pending.current = false; setBusy(false); }
  };
  return <div className="nm-neuron-name">
    {editing ? <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <input autoFocus aria-label="Tên neuron" value={value} disabled={busy} aria-invalid={Boolean(error)} maxLength={120}
        onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); cancel(); } }} />
      <button type="submit" disabled={busy} aria-label="Lưu tên neuron">{busy ? "Đang lưu…" : "Lưu"}</button>
      <button type="button" disabled={busy} aria-label="Hủy đổi tên" onClick={cancel}>Hủy</button>
    </form> : <div className="nm-neuron-name-row"><button type="button" className="nm-neuron-name-label" aria-label={`Đổi tên neuron ${name}`} onClick={() => { setValue(name); setEditing(true); }}><h2 id="neuron-note-title">{name}</h2></button>
      {showEditButton ? <button type="button" aria-label="Đổi tên neuron" onClick={() => { setValue(name); setEditing(true); }}><Pencil size={15} /></button> : null}</div>}
    {error && <p role="alert" className="nm-neuron-name-error">{error}</p>}
  </div>;
}
