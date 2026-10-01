import { useLayoutEffect, useRef } from "react";
import {
  insertCodeBlock,
  insertLink,
  prefixSelectedLines,
  wrapMarkers,
  type EditorRange,
} from "../markdown/editMarkdown";

const TOOLBAR: Array<{ label: string; title: string; apply: (range: EditorRange) => EditorRange }> = [
  { label: "H1", title: "H1", apply: (range) => prefixSelectedLines(range, "# ") },
  { label: "H2", title: "H2", apply: (range) => prefixSelectedLines(range, "## ") },
  { label: "H3", title: "H3", apply: (range) => prefixSelectedLines(range, "### ") },
  { label: "B", title: "In đậm", apply: (range) => wrapMarkers(range, "**") },
  { label: "I", title: "In nghiêng", apply: (range) => wrapMarkers(range, "*") },
  { label: "•", title: "Danh sách", apply: (range) => prefixSelectedLines(range, "- ") },
  { label: "1.", title: "Danh sách số", apply: (range) => prefixSelectedLines(range, "1. ") },
  { label: "☑", title: "Checklist", apply: (range) => prefixSelectedLines(range, "- [ ] ") },
  { label: "{}", title: "Khối mã", apply: insertCodeBlock },
  { label: "Link", title: "Liên kết", apply: insertLink },
];

function currentRange(textarea: HTMLTextAreaElement, value: string): EditorRange {
  return { value, start: textarea.selectionStart, end: textarea.selectionEnd };
}

type MarkdownComposeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function MarkdownComposeEditor({ value, onChange, disabled }: MarkdownComposeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const selection = selectionRef.current;
    if (!textarea || !selection) return;
    textarea.focus();
    textarea.setSelectionRange(selection.start, selection.end);
    selectionRef.current = null;
  }, [value]);

  const applyRange = (transform: (range: EditorRange) => EditorRange) => {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;
    const next = transform(currentRange(textarea, value));
    selectionRef.current = { start: next.start, end: next.end };
    onChange(next.value);
  };

  return (
    <div className="nm-md-compose">
      <div className="nm-md-toolbar" role="toolbar" aria-label="Markdown">
        {TOOLBAR.map((action) => (
          <button
            key={action.label}
            type="button"
            title={action.title}
            disabled={disabled}
            className="nm-md-tool"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyRange(action.apply)}
          >
            {action.label}
          </button>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        aria-label="Note Markdown"
        className="nm-md-editor"
        spellCheck={false}
        disabled={disabled}
        placeholder="Viết nội dung Markdown..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          const modifier = event.ctrlKey || event.metaKey;
          if (!modifier) return;
          const key = event.key.toLowerCase();
          if (key === "b") {
            event.preventDefault();
            applyRange((range) => wrapMarkers(range, "**"));
          }
          if (key === "i") {
            event.preventDefault();
            applyRange((range) => wrapMarkers(range, "*"));
          }
        }}
      />
    </div>
  );
}
