import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { neuronMarkdownStore } from "../markdown/neuronMarkdownStore";

type NeuronMarkdownEditorProps = {
  neuronId: string;
};

type ToolbarAction = {
  label: string;
  title: string;
  apply: (textarea: HTMLTextAreaElement) => void;
};

function replaceSelection(textarea: HTMLTextAreaElement, next: string, cursorOffset?: number) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const updated = `${value.slice(0, start)}${next}${value.slice(end)}`;
  textarea.value = updated;
  const position = start + (cursorOffset ?? next.length);
  textarea.setSelectionRange(position, position);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();
}

function wrapSelection(textarea: HTMLTextAreaElement, before: string, after = before) {
  const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd) || "text";
  replaceSelection(textarea, `${before}${selected}${after}`, before.length + selected.length);
}

function prefixLines(textarea: HTMLTextAreaElement, prefix: string) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const block = value.slice(lineStart, end);
  const next = block
    .split("\n")
    .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line || ""}`))
    .join("\n");
  textarea.setSelectionRange(lineStart, end);
  replaceSelection(textarea, next);
}

const TOOLBAR: ToolbarAction[] = [
  { label: "H1", title: "Heading 1", apply: (el) => prefixLines(el, "# ") },
  { label: "H2", title: "Heading 2", apply: (el) => prefixLines(el, "## ") },
  { label: "H3", title: "Heading 3", apply: (el) => prefixLines(el, "### ") },
  { label: "B", title: "Bold", apply: (el) => wrapSelection(el, "**") },
  { label: "I", title: "Italic", apply: (el) => wrapSelection(el, "*") },
  { label: "•", title: "Bullet list", apply: (el) => prefixLines(el, "- ") },
  { label: "1.", title: "Numbered list", apply: (el) => prefixLines(el, "1. ") },
  { label: "☑", title: "Checklist", apply: (el) => prefixLines(el, "- [ ] ") },
  { label: "❝", title: "Blockquote", apply: (el) => prefixLines(el, "> ") },
  { label: "`", title: "Inline code", apply: (el) => wrapSelection(el, "`") },
  {
    label: "{ }",
    title: "Code block",
    apply: (el) => {
      const selected = el.value.slice(el.selectionStart, el.selectionEnd) || "code";
      replaceSelection(el, `\n\`\`\`\n${selected}\n\`\`\`\n`, 5);
    },
  },
  {
    label: "Link",
    title: "Link",
    apply: (el) => {
      const selected = el.value.slice(el.selectionStart, el.selectionEnd) || "text";
      replaceSelection(el, `[${selected}](https://)`, 1 + selected.length + 3);
    },
  },
  {
    label: "Table",
    title: "Table",
    apply: (el) => replaceSelection(el, "\n| Cột 1 | Cột 2 |\n| --- | --- |\n|  |  |\n"),
  },
];

export function NeuronMarkdownEditor({ neuronId }: NeuronMarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(() => neuronMarkdownStore.get(neuronId));
  const [savedValue, setSavedValue] = useState(() => neuronMarkdownStore.get(neuronId));
  const [fullscreen, setFullscreen] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const next = neuronMarkdownStore.get(neuronId);
    setValue(next);
    setSavedValue(next);
    setStatus("");
    setFullscreen(false);
  }, [neuronId]);

  const save = () => {
    neuronMarkdownStore.set(neuronId, value);
    setSavedValue(value);
    setStatus("Đã lưu");
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
                onClick={() => {
                  const textarea = textareaRef.current;
                  if (!textarea) return;
                  action.apply(textarea);
                  const next = textarea.value;
                  setValue(next);
                  neuronMarkdownStore.set(neuronId, next);
                  setStatus("");
                }}
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
            value={value}
            onChange={(event) => {
              const next = event.target.value;
              setValue(next);
              neuronMarkdownStore.set(neuronId, next);
              setStatus("");
            }}
          />
        </div>
        <div className="neuron-md-pane neuron-md-preview-wrap">
          <p className="neuron-md-preview-label">Xem trước</p>
          <div className="neuron-md-preview">
            {value.trim() ? <Markdown remarkPlugins={[remarkGfm]}>{value}</Markdown> : <p className="neuron-md-empty">Chưa có nội dung.</p>}
          </div>
        </div>
      </div>

      <footer className="neuron-md-foot">
        <p>Markdown • {value.length} ký tự</p>
        <div className="neuron-md-foot-actions">
          <span role="status">{status || (value === savedValue && savedValue ? "Đã lưu" : "")}</span>
          <button type="button" className="brutal-button brutal-button-primary" disabled={value === savedValue} onClick={save}>
            Lưu
          </button>
        </div>
      </footer>
    </section>
  );
}