import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NeuronMarkdownPreview } from "./NeuronMarkdownPreview";
import { getNeuronMarkdown, saveNeuronMarkdown } from "../api/markdownNotes";
import {
  insertCodeBlock,
  insertLink,
  insertTable,
  prefixSelectedLines,
  wrapMarkers,
  type EditorRange,
} from "../markdown/editMarkdown";
import { neuronMarkdownStore } from "../markdown/neuronMarkdownStore";

type SaveStatus = "saved" | "unsaved" | "saving" | "error";

type ToolbarAction = {
  label: string;
  title: string;
  apply: (range: EditorRange) => EditorRange;
};

const TOOLBAR: ToolbarAction[] = [
  { label: "H1", title: "H1 — Tiêu đề 1", apply: (range) => prefixSelectedLines(range, "# ") },
  { label: "H2", title: "H2 — Tiêu đề 2", apply: (range) => prefixSelectedLines(range, "## ") },
  { label: "H3", title: "H3 — Tiêu đề 3", apply: (range) => prefixSelectedLines(range, "### ") },
  { label: "B", title: "B — In đậm (Ctrl+B)", apply: (range) => wrapMarkers(range, "**") },
  { label: "I", title: "I — In nghiêng (Ctrl+I)", apply: (range) => wrapMarkers(range, "*") },
  { label: "•", title: "Bullet list — Danh sách", apply: (range) => prefixSelectedLines(range, "- ") },
  { label: "1.", title: "Numbered list — Danh sách số", apply: (range) => prefixSelectedLines(range, "1. ") },
  { label: "☑", title: "Checklist — Việc cần làm", apply: (range) => prefixSelectedLines(range, "- [ ] ") },
  { label: "❝", title: "Blockquote — Trích dẫn", apply: (range) => prefixSelectedLines(range, "> ") },
  { label: "`", title: "Inline code — Mã trong dòng", apply: (range) => wrapMarkers(range, "`") },
  { label: "{ }", title: "Code block — Khối mã", apply: insertCodeBlock },
  { label: "Link", title: "Link — Chèn liên kết", apply: insertLink },
  { label: "Table", title: "Table — Chèn bảng", apply: insertTable },
];

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "Đã lưu",
  unsaved: "Chưa lưu",
  saving: "Đang lưu...",
  error: "Lưu thất bại",
};

function currentRange(textarea: HTMLTextAreaElement, value: string): EditorRange {
  return { value, start: textarea.selectionStart, end: textarea.selectionEnd };
}

export function NeuronMarkdownEditor({ neuronId }: { neuronId: string }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(() => neuronMarkdownStore.getWorking(neuronId));
  const [savedValue, setSavedValue] = useState(() => neuronMarkdownStore.getSaved(neuronId));
  const [status, setStatus] = useState<SaveStatus>(() =>
    neuronMarkdownStore.getWorking(neuronId) === neuronMarkdownStore.getSaved(neuronId) ? "saved" : "unsaved",
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const loadRequestRef = useRef(0);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const selection = selectionRef.current;
    if (!textarea || !selection) return;
    textarea.focus();
    textarea.setSelectionRange(selection.start, selection.end);
    selectionRef.current = null;
  }, [value]);

  useEffect(() => {
    const requestId = ++loadRequestRef.current;
    const controller = new AbortController();
    const dirty = neuronMarkdownStore.isDirty(neuronId);
    const working = neuronMarkdownStore.getWorking(neuronId);
    setValue(working);
    setSavedValue(neuronMarkdownStore.getSaved(neuronId));
    setStatus(dirty ? "unsaved" : "saved");
    setPast([]);
    setFuture([]);
    setFullscreen(false);

    void getNeuronMarkdown(neuronId, controller.signal)
      .then((note) => {
        if (requestId !== loadRequestRef.current) return;
        if (neuronMarkdownStore.isDirty(neuronId)) return;
        const content = note.content ?? "";
        if (!neuronMarkdownStore.applyServer(neuronId, content)) return;
        setValue(content);
        setSavedValue(content);
        setStatus("saved");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (requestId !== loadRequestRef.current) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
      });

    return () => {
      controller.abort();
    };
  }, [neuronId]);

  const markUnsaved = (next: string, previous: string, recordHistory: boolean) => {
    if (recordHistory && next !== previous) {
      setPast((current) => [...current.slice(-79), previous]);
      setFuture([]);
    }
    setValue(next);
    neuronMarkdownStore.setWorking(neuronId, next);
    setStatus(next === savedValue ? "saved" : "unsaved");
  };

  const applyRange = (transform: (range: EditorRange) => EditorRange) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const next = transform(currentRange(textarea, value));
    selectionRef.current = { start: next.start, end: next.end };
    markUnsaved(next.value, value, true);
  };

  const save = async () => {
    if (status === "saving") return;
    setStatus("saving");
    const snapshot = value;
    try {
      await saveNeuronMarkdown(neuronId, snapshot);
      neuronMarkdownStore.commit(neuronId, snapshot);
      setSavedValue(snapshot);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  const undo = () => {
    if (!past.length) return;
    const previous = past[past.length - 1];
    setPast((current) => current.slice(0, -1));
    setFuture((current) => [...current, value]);
    setValue(previous);
    neuronMarkdownStore.setWorking(neuronId, previous);
    setStatus(previous === savedValue ? "saved" : "unsaved");
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[future.length - 1];
    setFuture((current) => current.slice(0, -1));
    setPast((current) => [...current, value]);
    setValue(next);
    neuronMarkdownStore.setWorking(neuronId, next);
    setStatus(next === savedValue ? "saved" : "unsaved");
  };

  return (
    <section className={`neuron-md ${fullscreen ? "is-fullscreen" : ""}`}>
      <header className="neuron-md-head">
        <h3>Note Markdown</h3>
        <button type="button" className="brutal-button brutal-button-compact" onClick={() => setFullscreen((open) => !open)}>
          {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          {fullscreen ? "Thu nhỏ" : "Xem toàn màn hình"}
        </button>
      </header>

      <div className="neuron-md-split">
        <div className="neuron-md-pane">
          <div className="neuron-md-toolbar" role="toolbar" aria-label="Markdown">
            {TOOLBAR.map((action) => (
              <button
                key={action.title}
                type="button"
                title={action.title}
                className="neuron-md-tool"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyRange(action.apply)}
              >
                {action.label}
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            aria-label="Markdown editor"
            className="neuron-md-editor"
            spellCheck={false}
            placeholder="Bắt đầu viết ghi chú bằng Markdown..."
            value={value}
            onChange={(event) => markUnsaved(event.target.value, value, true)}
            onKeyDown={(event) => {
              const modifier = event.ctrlKey || event.metaKey;
              if (!modifier) return;
              const key = event.key.toLowerCase();
              if (key === "b") {
                event.preventDefault();
                applyRange((range) => wrapMarkers(range, "**"));
                return;
              }
              if (key === "i") {
                event.preventDefault();
                applyRange((range) => wrapMarkers(range, "*"));
                return;
              }
              if (key === "s") {
                event.preventDefault();
                void save();
                return;
              }
              if (key === "y") {
                event.preventDefault();
                redo();
                return;
              }
              if (key === "z") {
                event.preventDefault();
                if (event.shiftKey) redo();
                else undo();
              }
            }}
          />
        </div>
        <div className="neuron-md-pane neuron-md-preview-wrap">
          <p className="neuron-md-preview-label">Xem trước</p>
          <div className="neuron-md-preview">
            <NeuronMarkdownPreview value={value} />
          </div>
        </div>
      </div>

      <footer className="neuron-md-foot">
        <p>Markdown • {value.length} ký tự</p>
        <div className="neuron-md-foot-actions">
          <span role="status">{STATUS_LABEL[status]}</span>
          <button type="button" className="brutal-button brutal-button-primary" disabled={status === "saving" || status === "saved"} onClick={() => void save()}>
            Lưu
          </button>
        </div>
      </footer>
    </section>
  );
}
