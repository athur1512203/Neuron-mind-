import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DocumentMeta } from "../api/documents";
import { getNeuronMarkdown, saveNeuronMarkdown } from "../api/markdownNotes";
import {
  insertCodeBlock,
  insertAtCursor,
  insertLink,
  insertTable,
  prefixSelectedLines,
  wrapMarkers,
  type EditorRange,
} from "../markdown/editMarkdown";
import { neuronMarkdownStore } from "../markdown/neuronMarkdownStore";
import type { Neuron, NeuronConnection } from "../types";
import { areSameConnection } from "../utils/neuron";
import { Button } from "./ui/Button";
import { VisualNoteEditor } from "./VisualNoteEditor";

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
  { label: "Table", title: "Table — Chèn bảng", apply: insertTable },
];

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "Đã lưu",
  unsaved: "Chưa lưu",
  saving: "Đang lưu...",
  error: "Lưu thất bại",
};

type NeuronMarkdownEditorProps = {
  neuronId: string;
  neurons?: Neuron[];
  documents?: DocumentMeta[];
  connections?: NeuronConnection[];
  onSaved?: (content: string) => void;
  onEnsureConnection?: (targetNeuronId: string) => void | Promise<void>;
};

function currentRange(textarea: HTMLTextAreaElement, value: string): EditorRange {
  return { value, start: textarea.selectionStart, end: textarea.selectionEnd };
}

export function NeuronMarkdownEditor({
  neuronId,
  neurons = [],
  documents = [],
  connections = [],
  onSaved,
  onEnsureConnection,
}: NeuronMarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"visual" | "markdown">("visual");
  const savingRef = useRef(false);
  const [value, setValue] = useState(() => neuronMarkdownStore.getWorking(neuronId));
  const [savedValue, setSavedValue] = useState(() => neuronMarkdownStore.getSaved(neuronId));
  const [status, setStatus] = useState<SaveStatus>(() =>
    neuronMarkdownStore.getWorking(neuronId) === neuronMarkdownStore.getSaved(neuronId) ? "saved" : "unsaved",
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [linkMenuOpen, setLinkMenuOpen] = useState(false);
  const [documentMenuOpen, setDocumentMenuOpen] = useState(false);
  const [relationMenuOpen, setRelationMenuOpen] = useState(false);
  const [relationQuery, setRelationQuery] = useState("");
  const savedSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const loadRequestRef = useRef(0);

  const relationTargets = neurons
    .filter((neuron) => neuron.id !== neuronId)
    .filter((neuron) => neuron.name.toLowerCase().includes(relationQuery.trim().toLowerCase()));

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const selection = pendingSelectionRef.current;
    if (!textarea || !selection) return;
    textarea.focus();
    textarea.setSelectionRange(selection.start, selection.end);
    pendingSelectionRef.current = null;
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
    setLinkMenuOpen(false);
    setDocumentMenuOpen(false);
    setRelationMenuOpen(false);
    setRelationQuery("");
    savedSelectionRef.current = null;
    pendingSelectionRef.current = null;

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
    pendingSelectionRef.current = { start: next.start, end: next.end };
    markUnsaved(next.value, value, true);
  };

  const rememberSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    savedSelectionRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd };
  };

  const rangeFromRememberedSelection = (): EditorRange => {
    const textarea = textareaRef.current;
    const selection = savedSelectionRef.current;
    if (selection) {
      return { value, start: selection.start, end: selection.end };
    }
    if (textarea) return currentRange(textarea, value);
    return { value, start: value.length, end: value.length };
  };

  const insertFromRememberedSelection = (transform: (range: EditorRange) => EditorRange) => {
    const next = transform(rangeFromRememberedSelection());
    pendingSelectionRef.current = { start: next.start, end: next.end };
    savedSelectionRef.current = { start: next.start, end: next.end };
    markUnsaved(next.value, value, true);
    setLinkMenuOpen(false);
    setDocumentMenuOpen(false);
    setRelationMenuOpen(false);
  };

  const insertDocumentToken = (documentId: string) => {
    insertFromRememberedSelection((range) => insertAtCursor(range, `[[document:${documentId}]]`, `[[document:${documentId}]]`.length));
  };

  const insertRelationToken = (targetNeuronId: string) => {
    insertFromRememberedSelection((range) => insertAtCursor(range, `[[relation:${targetNeuronId}]]`, `[[relation:${targetNeuronId}]]`.length));
    const exists = connections.some((connection) =>
      areSameConnection(neuronId, targetNeuronId, connection.sourceNeuronId, connection.targetNeuronId),
    );
    if (!exists) void onEnsureConnection?.(targetNeuronId);
  };

  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setStatus("saving");
    const snapshot = value;
    try {
      await saveNeuronMarkdown(neuronId, snapshot);
      neuronMarkdownStore.commit(neuronId, snapshot);
      setSavedValue(snapshot);
      setStatus("saved");
      onSaved?.(snapshot);
    } catch {
      setStatus("error");
    } finally {
      savingRef.current = false;
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
    <section className={`neuron-md ${fullscreen ? "is-fullscreen" : ""}`} onKeyDown={(event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void save(); }
    }}>
      <header className="neuron-md-head">
        <h3>Note Markdown</h3>
        <Button variant="secondary" size="sm" onClick={() => setFullscreen((open) => !open)}>
          {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          {fullscreen ? "Thu nhỏ" : "Xem toàn màn hình"}
        </Button>
      </header>

      <div className="nm-note-modes" role="group" aria-label="Chế độ ghi chú">
        <button type="button" aria-pressed={mode === "visual"} onClick={() => setMode("visual")}>Soạn thảo</button>
        <button type="button" aria-pressed={mode === "markdown"} onClick={() => setMode("markdown")}>Markdown</button>
      </div>
      {mode === "visual" ? <VisualNoteEditor value={value} onChange={(next) => markUnsaved(next, value, true)}
        disabled={status === "saving"} onRaw={() => setMode("markdown")} neurons={neurons} documents={documents} /> :
      <fieldset disabled={status === "saving"} className="neuron-md-split neuron-md-editor-layout" style={{ margin: 0, padding: 0, border: 0 }}>
        <div className="neuron-md-pane">
          <div className="neuron-md-toolbar" role="toolbar" aria-label="Markdown">
            {TOOLBAR.map((action) => (
              <Button
                key={action.title}
                variant="toolbar"
                type="button"
                title={action.title}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyRange(action.apply)}
              >
                {action.label}
              </Button>
            ))}
            <span className="neuron-md-tool-group">
              <Button
                variant="toolbar"
                type="button"
                title="Link — Tài liệu hoặc website"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  rememberSelection();
                  setLinkMenuOpen((open) => !open);
                  setDocumentMenuOpen(false);
                  setRelationMenuOpen(false);
                }}
              >
                Link
              </Button>
              {linkMenuOpen ? (
                <span className="neuron-md-popover">
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setLinkMenuOpen(false);
                      setDocumentMenuOpen((open) => !open);
                    }}
                  >
                    Tài liệu
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertFromRememberedSelection(insertLink)}
                  >
                    Website
                  </button>
                </span>
              ) : null}
              {documentMenuOpen ? (
                <span className="neuron-md-popover neuron-md-picker">
                  {documents.length ? documents.map((document) => (
                    <button
                      key={document.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertDocumentToken(document.id)}
                    >
                      {document.originalName}
                    </button>
                  )) : <span className="neuron-md-picker-empty">Chưa có tài liệu.</span>}
                </span>
              ) : null}
            </span>
            <span className="neuron-md-tool-group">
              <Button
                variant="toolbar"
                type="button"
                title="Liên kết — Chèn relation tới neuron"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  rememberSelection();
                  setRelationMenuOpen((open) => !open);
                  setLinkMenuOpen(false);
                  setDocumentMenuOpen(false);
                }}
              >
                Liên kết
              </Button>
              {relationMenuOpen ? (
                <span className="neuron-md-popover neuron-md-picker">
                  <input
                    value={relationQuery}
                    onMouseDown={(event) => event.stopPropagation()}
                    onChange={(event) => setRelationQuery(event.target.value)}
                    placeholder="Tìm neuron..."
                    aria-label="Tìm neuron để liên kết"
                  />
                  {relationTargets.length ? relationTargets.map((neuron) => (
                    <button
                      key={neuron.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertRelationToken(neuron.id)}
                    >
                      {neuron.name}
                    </button>
                  )) : <span className="neuron-md-picker-empty">Không có neuron phù hợp.</span>}
                </span>
              ) : null}
            </span>
          </div>
          <textarea
            ref={textareaRef}
            aria-label="Markdown editor"
            className="neuron-md-editor"
            dir="ltr"
            spellCheck={false}
            placeholder="Bắt đầu viết ghi chú bằng Markdown..."
            value={value}
            onChange={(event) => markUnsaved(event.target.value, value, true)}
            onSelect={rememberSelection}
            onClick={rememberSelection}
            onKeyUp={rememberSelection}
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
      </fieldset>}

      <footer className="neuron-md-foot">
        <p>Markdown • {value.length} ký tự</p>
        <div className="neuron-md-foot-actions">
          <span role="status">{STATUS_LABEL[status]}</span>
          <Button variant="primary" disabled={status === "saving" || status === "saved"} onClick={() => void save()}>
            Lưu
          </Button>
        </div>
      </footer>
    </section>
  );
}
