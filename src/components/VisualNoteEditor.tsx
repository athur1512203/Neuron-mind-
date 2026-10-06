import { useRef, useState } from "react";
import { blockCommands, formatBlock, parseNoteBlocks, replaceNoteBlock, type BlockKind, type NoteBlock } from "../markdown/visualBlocks";
import { insertLink, wrapMarkers } from "../markdown/editMarkdown";
import { NeuronMarkdownPreview } from "./NeuronMarkdownPreview";
import type { Neuron } from "../types";
import type { DocumentMeta } from "../api/documents";
import "./visual-note.css";

export function VisualNoteEditor({ value, onChange, disabled, onRaw, neurons, documents }: {
  value: string; onChange: (value: string) => void; disabled: boolean; onRaw: () => void;
  neurons: Neuron[]; documents: DocumentMeta[];
}) {
  const [active, setActive] = useState<NoteBlock | null>(null);
  // Keep an empty edited block anchored at its source offset so deleting its text
  // never moves the editor into the following block.
  const blocks = active ? [...parseNoteBlocks(value).filter((item) =>
    item.start !== active.start && (item.end <= active.start || item.start >= active.end)), active].sort((a, b) => a.start - b.start)
    : parseNoteBlocks(value);
  const [menu, setMenu] = useState(false);
  const [command, setCommand] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const block = active;
  const change = (text: string, kind: BlockKind = block?.kind ?? "text") => {
    if (!block || disabled) return;
    const raw = formatBlock(kind, text, block);
    setActive({ ...block, kind, text, raw, end: block.start + raw.length });
    onChange(replaceNoteBlock(value, block, raw));
  };
  const choose = (kind: BlockKind) => {
    if (block?.kind === "raw") return;
    if (block) change(menu ? "" : block.text, kind);
    else { const next = `${value}${value ? "\n\n" : ""}${formatBlock(kind, "")}`; onChange(next); setActive(parseNoteBlocks(next).at(-1)!); }
    setMenu(false);
    requestAnimationFrame(() => input.current?.focus());
  };
  const inline = (marker: string) => {
    if (!block || !input.current || disabled) return;
    const range = { value: block.text, start: input.current.selectionStart, end: input.current.selectionEnd };
    const next = marker === "link" ? insertLink(range) : wrapMarkers(range, marker);
    change(next.value);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(next.start, next.end); });
  };
  return <div className="nm-visual-note">
    <div className="nm-visual-toolbar" role="toolbar" aria-label="Soạn thảo">
      <select aria-label="Kiểu block" value={block?.kind ?? "text"} disabled={disabled || block?.kind === "raw"}
        onChange={(event) => choose(event.target.value as BlockKind)}>
        {blockCommands.map((item) => <option key={item.kind} value={item.kind}>{item.kind === "text" ? "Paragraph" : item.label}</option>)}
        <option value="raw" disabled>Markdown gốc</option>
      </select>
      {[["B", "In đậm", "**"], ["I", "In nghiêng", "*"], ["Link", "Liên kết web", "link"], ["`", "Mã trong dòng", "`"]].map(([label, title, marker]) =>
        <button key={marker} type="button" title={title} aria-label={title} disabled={disabled || !block || block.kind === "raw"}
          onMouseDown={(event) => event.preventDefault()} onClick={() => inline(marker)}>{label}</button>)}
    </div>
    <p className="nm-visual-hint">Chọn một block để sửa · Gõ / trong block trống để chọn định dạng</p>
    <div className="nm-visual-blocks">
      {blocks.map((item, index) => <div key={index} className={`nm-visual-block is-${item.kind}`}>
        {active?.start === item.start && item.kind !== "raw" && item.kind !== "divider" ? <textarea ref={input} autoFocus
          aria-label={`Nội dung block ${index + 1}`} value={item.text} disabled={disabled} rows={Math.max(2, item.text.split("\n").length)}
          onChange={(event) => { change(event.target.value); setMenu(event.target.value === "/"); setCommand(0); }}
          onBlur={(event) => { if (!event.relatedTarget?.closest(".nm-visual-toolbar, .nm-slash-menu")) { setActive(null); setMenu(false); } }}
          onKeyDown={(event) => {
            if (menu) {
              if (["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) event.preventDefault();
              if (event.key === "ArrowDown") setCommand((command + 1) % blockCommands.length);
              if (event.key === "ArrowUp") setCommand((command + blockCommands.length - 1) % blockCommands.length);
              if (event.key === "Enter") choose(blockCommands[command].kind);
              if (event.key === "Escape") setMenu(false);
            } else if (event.key === "Escape") setActive(null);
          }} /> : <div className="nm-visual-rendered neuron-md-preview">
          {item.kind === "check" ? item.raw.split("\n").map((line, lineIndex) => <label key={lineIndex} style={{ display: "flex", gap: 8 }}>
            <input type="checkbox" disabled={disabled} checked={/^- \[[xX]\]/.test(line)} aria-label={`Hoàn thành: ${line.slice(6)}`}
              onChange={(event) => {
                const lines = item.raw.split("\n"); lines[lineIndex] = line.replace(/^- \[[ xX]\]/, event.target.checked ? "- [x]" : "- [ ]");
                onChange(replaceNoteBlock(value, item, lines.join("\n")));
              }} />
            <NeuronMarkdownPreview value={line.slice(6)} neurons={neurons} documents={documents} />
          </label>) : <NeuronMarkdownPreview value={item.raw} neurons={neurons} documents={documents} />}
          <button type="button" disabled={disabled} className="nm-visual-edit" onClick={() => { if (item.kind === "raw" || item.kind === "divider") onRaw(); else setActive(item); }}>
            {item.kind === "raw" ? "Sửa Markdown gốc" : "Sửa block"}
          </button>
        </div>}
        {menu && active?.start === item.start && <div className="nm-slash-menu" role="listbox" aria-label="Chọn kiểu block">
          {blockCommands.map((item, i) => <button type="button" role="option" aria-selected={command === i} key={item.kind}
            onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item.kind)}>{item.label}</button>)}
        </div>}
      </div>)}
      <button type="button" className="nm-visual-add" disabled={disabled} onClick={() => {
        const next = `${value}${value ? "\n\n" : ""}`;
        onChange(next); setActive(parseNoteBlocks(next).at(-1)!);
      }}>+ Thêm đoạn văn</button>
    </div>
  </div>;
}
