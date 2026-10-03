import { FileText, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiMessage } from "../api/client";
import { uploadDocument as uploadDocumentApi, validateDocumentFile } from "../api/documents";
import { saveNeuronMarkdown } from "../api/markdownNotes";
import { neuronMarkdownStore } from "../markdown/neuronMarkdownStore";
import type { Neuron } from "../types";
import { colorPresets } from "../utils/neuron";
import { NeuronColorPicker } from "./NeuronColorPicker";
import { MarkdownComposeEditor } from "./MarkdownComposeEditor";
import { Button } from "./ui/Button";

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

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

type CreateNeuronModalProps = {
  subjectId: string;
  neuronCount: number;
  onClose: () => void;
  onCreate: (neuron: Neuron) => Promise<Neuron>;
};

export function CreateNeuronModal({ subjectId, neuronCount, onClose, onCreate }: CreateNeuronModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(colorPresets[0].value);
  const [markdown, setMarkdown] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdNeuronId, setCreatedNeuronId] = useState<string | null>(null);
  const [markdownSaved, setMarkdownSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createdIdRef = useRef<string | null>(null);
  const markdownSavedRef = useRef(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const addPendingFiles = (files: FileList | null) => {
    const selected = Array.from(files ?? []);
    if (!selected.length) return;
    const invalid = selected.map((file) => ({ file, message: validateDocumentFile(file) })).find((item) => item.message);
    if (invalid) {
      setError(`${invalid.file.name}: ${invalid.message}`);
      return;
    }
    setError("");
    setPendingFiles((current) => [...current, ...selected]);
  };

  const handleSubmit = async () => {
    if (busy) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Nhập tên neuron.");
      return;
    }
    if (trimmedName.length > 120) {
      setError("Tên neuron tối đa 120 ký tự.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      let neuronId = createdIdRef.current;
      if (!neuronId) {
        const timestamp = new Date().toISOString();
        const created = await onCreate({
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
        neuronId = created.id;
        createdIdRef.current = neuronId;
        setCreatedNeuronId(neuronId);
      }

      const markdownContent = markdown.trim();
      if (markdownContent && !markdownSavedRef.current) {
        await saveNeuronMarkdown(neuronId, markdown);
        neuronMarkdownStore.commit(neuronId, markdown);
        markdownSavedRef.current = true;
        setMarkdownSaved(true);
      }

      const remaining: File[] = [];
      let failedCount = 0;
      for (const file of pendingFiles) {
        const message = validateDocumentFile(file);
        if (message) {
          remaining.push(file);
          failedCount += 1;
          continue;
        }
        try {
          await uploadDocumentApi(subjectId, file);
        } catch {
          remaining.push(file);
          failedCount += 1;
        }
      }
      setPendingFiles(remaining);

      if (failedCount) {
        setError(`Neuron đã được tạo nhưng ${failedCount} tài liệu tải lên thất bại.`);
        return;
      }

      onClose();
    } catch (caught) {
      if (createdIdRef.current && !markdownSavedRef.current && markdown.trim()) {
        setError(apiMessage(caught, "Neuron đã được tạo nhưng không lưu được Note Markdown."));
      } else {
        setError(apiMessage(caught, "Không tạo được neuron."));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="nm-modal-overlay" onClick={() => { if (!busy) onClose(); }}>
      <section
        className="nm-modal nm-modal-lg nm-modal-create"
        onClick={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <header className="nm-modal-head">
          <div>
            <h2>Tạo neuron</h2>
            <p>Thêm kiến thức mới vào không gian.</p>
          </div>
          <Button variant="icon" onClick={onClose} aria-label="Đóng" disabled={busy}>
            <X size={18} />
          </Button>
        </header>

        <div className="nm-modal-body">
          <label className="nm-field">
            <span>Tên neuron *</span>
            <input
              value={name}
              disabled={busy || Boolean(createdNeuronId)}
              onChange={(event) => setName(event.target.value)}
              className="nm-input"
              placeholder="Ví dụ: React, Marketing, Tiếng Anh..."
              maxLength={120}
            />
          </label>

          <div className="nm-field">
            <span>Màu neuron</span>
            <NeuronColorPicker
              value={color}
              onChange={setColor}
              disabled={busy || Boolean(createdNeuronId)}
            />
          </div>

          <div className="nm-field">
            <span>Note Markdown</span>
            <p className="nm-field-hint">Nội dung kiến thức chính của neuron.</p>
            <MarkdownComposeEditor
              value={markdown}
              onChange={setMarkdown}
              disabled={busy || markdownSaved}
            />
          </div>

          <div className="nm-field">
            <span>Tài liệu</span>
            <p className="nm-field-hint">Tài liệu sẽ được lưu dùng chung trong không gian hiện tại.</p>
            <button
              type="button"
              className="nm-drop"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                addPendingFiles(event.dataTransfer.files);
              }}
            >
              <Upload size={18} />
              <strong>Chọn hoặc kéo thả tài liệu</strong>
              <small>PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, MD, ZIP</small>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.zip"
              className="sr-only"
              onChange={(event) => {
                addPendingFiles(event.target.files);
                event.target.value = "";
              }}
            />
            {pendingFiles.length ? (
              <ul className="nm-pending-docs">
                {pendingFiles.map((file, index) => (
                  <li key={`${file.name}-${file.size}-${index}`} className="nm-pending-doc">
                    <FileText size={18} />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate">{file.name}</strong>
                      <small>{formatFileSize(file.size)}</small>
                    </span>
                    <Button
                      variant="toolbar"
                      type="button"
                      className="nm-pending-remove"
                      aria-label={`Gỡ ${file.name}`}
                      disabled={busy}
                      onClick={() => setPendingFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      ×
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {error ? <p className="nm-modal-error">{error}</p> : null}
        </div>

        <footer className="nm-modal-foot">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Hủy</Button>
          <Button variant="primary" onClick={() => void handleSubmit()} disabled={busy}>
            {busy ? "Đang tạo..." : "Tạo neuron"}
          </Button>
        </footer>
      </section>
    </div>
  );
}
