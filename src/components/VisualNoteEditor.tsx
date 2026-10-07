import { useEffect, useRef, useState } from "react";
import { EditorState, TextSelection, type Command } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { baseKeymap, setBlockType, toggleMark, chainCommands, splitBlock } from "prosemirror-commands";
import { history, undo, redo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { Plus, GripVertical, X } from "lucide-react";
import { NoteToolbar } from "./NoteToolbar";
import { noteSchema, parseDocument, serializeDocument, createTable, safeLink, highlightColors } from "../markdown/documentEditor";
import { imageTypes, loadDocumentImage, uploadDocument, validateImageFile, type DocumentMeta } from "../api/documents";
import type { Neuron } from "../types";
import "prosemirror-view/style/prosemirror.css";
import "./visual-note.css";

type Props = { value: string; onChange: (value: string) => void; onRaw: () => void; neurons: Neuron[]; documents: DocumentMeta[];
  neuronId: string; onEnsureConnection: (id: string) => Promise<void> };
export const tableTab: Command = (state, dispatch) => {
  const cells: number[] = []; state.doc.descendants((node, pos) => { if (node.type.name === "table_cell") cells.push(pos + 1); });
  const current = cells.findIndex((pos) => pos <= state.selection.from && state.selection.from <= pos + state.doc.nodeAt(pos - 1)!.content.size);
  if (current < 0 || current + 1 >= cells.length) return false;
  dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, cells[current + 1])).scrollIntoView()); return true;
};
export const checklistEnter: Command = (state, dispatch) => {
  const { $from, $to } = state.selection;
  if ($from.parent.type.name !== "paragraph" || $from.depth < 2 || $from.node(-1).type.name !== "check_item" || !$from.sameParent($to)) return false;
  const item = $from.node(-1), start = $from.before($from.depth - 1);
  if (!$from.parent.content.size) return false;
  const left = noteSchema.nodes.check_item.create(item.attrs, noteSchema.nodes.paragraph.create(null, $from.parent.content.cut(0, $from.parentOffset)));
  const right = noteSchema.nodes.check_item.create({ checked: false }, noteSchema.nodes.paragraph.create(null, $from.parent.content.cut($to.parentOffset)));
  if (dispatch) { const tr = state.tr.replaceWith(start, start + item.nodeSize, [left, right]); dispatch(tr.setSelection(TextSelection.create(tr.doc, start + left.nodeSize + 2)).scrollIntoView()); }
  return true;
};
export function VisualNoteEditor(props: Props) {
  const host = useRef<HTMLDivElement>(null), view = useRef<EditorView | null>(null);
  const latest = useRef(props); latest.current = props;
  const emitted = useRef(props.value);
  const [menu, setMenu] = useState<"highlight" | "link" | "relation" | "table" | "image" | "insert" | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(""); const [label, setLabel] = useState(""); const [url, setUrl] = useState("");
  const [rows, setRows] = useState(2), [columns, setColumns] = useState(3);
  const [addedImages, setAddedImages] = useState<DocumentMeta[]>([]);
  const [handle, setHandle] = useState<{ top: number; pos: number } | null>(null);
  const blockAt = useRef<number | null>(null), popup = useRef<HTMLDivElement>(null), opener = useRef<HTMLElement | null>(null);
  const currentNeuron = props.neurons.find((n) => n.id === props.neuronId);
  const targets = props.neurons.filter((n) => n.id !== props.neuronId && n.subjectId === currentNeuron?.subjectId && n.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const close = () => { setMenu(null); setError(""); view.current?.focus(); };
  const open = (next: typeof menu) => { opener.current = document.activeElement as HTMLElement; setError(""); setMenu(next); };
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView(host.current, {
      state: EditorState.create({ schema: noteSchema, doc: parseDocument(latest.current.value), plugins: [history(), keymap({
        "Mod-z": undo, "Mod-Shift-z": redo, "Mod-y": redo, "Mod-b": toggleMark(noteSchema.marks.strong), "Mod-i": toggleMark(noteSchema.marks.em), "Mod-u": toggleMark(noteSchema.marks.underline),
        "Enter": chainCommands(checklistEnter, splitBlock), "Tab": tableTab,
        "Shift-Enter": (state, dispatch) => { dispatch?.(state.tr.replaceSelectionWith(noteSchema.nodes.hard_break.create()).scrollIntoView()); return true; },
      }), keymap(baseKeymap)] }),
      attributes: { class: "nm-note-document", role: "textbox", "aria-label": "Nội dung ghi chú", "aria-multiline": "true", spellcheck: "true" },
      dispatchTransaction(transaction) {
        editor.updateState(editor.state.apply(transaction));
        if (transaction.docChanged) { emitted.current = serializeDocument(editor.state.doc); latest.current.onChange(emitted.current); }
      },
      handlePaste(_view, event) { const text = event.clipboardData?.getData("text/plain"); if (text === undefined) return false; editor.dispatch(editor.state.tr.insertText(text)); return true; },
      nodeViews: {
        reference(node) {
          const dom = document.createElement("span"); dom.className = "neuron-md-ref-chip"; dom.contentEditable = "false";
          const name = node.attrs.kind === "relation" ? latest.current.neurons.find((n) => n.id === node.attrs.id)?.name : latest.current.documents.find((d) => d.id === node.attrs.id)?.originalName;
          dom.textContent = `${node.attrs.kind === "relation" ? "↗" : "▤"} ${name ?? "Liên kết không khả dụng"}`; return { dom };
        },
        image(node) {
          const dom = document.createElement("span"); dom.className = "nm-note-image"; dom.contentEditable = "false";
          const img = document.createElement("img"); img.alt = node.attrs.alt || "Ảnh ghi chú"; img.referrerPolicy = "no-referrer";
          const controller = new AbortController(); let objectUrl = "";
          if (node.attrs.url.startsWith("document://")) {
            dom.textContent = "Đang tải ảnh...";
            void loadDocumentImage(decodeURIComponent(node.attrs.url.slice(11)), controller.signal).then((url) => {
              objectUrl = url; if (controller.signal.aborted) URL.revokeObjectURL(url); else { img.src = url; dom.replaceChildren(img); }
            }).catch(() => { if (!controller.signal.aborted) dom.textContent = "Không tải được ảnh."; });
          } else if (safeLink(node.attrs.url)) { img.src = node.attrs.url; dom.append(img); }
          return { dom, destroy() { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); } };
        },
        check_item(node, _view, getPos) {
          let current = node;
          const dom = document.createElement("div"); dom.className = "nm-check-item";
          const check = document.createElement("input"); check.type = "checkbox"; check.checked = node.attrs.checked; check.contentEditable = "false"; check.setAttribute("aria-label", "Hoàn thành công việc");
          const contentDOM = document.createElement("div"); dom.append(check, contentDOM);
          check.addEventListener("change", () => { const pos = getPos(); if (pos !== undefined) editor.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, checked: check.checked })); });
          return { dom, contentDOM, update(next) { if (next.type !== current.type) return false; current = next; check.checked = next.attrs.checked; return true; }, stopEvent: (event) => event.target === check };
        },
        raw() {
          const dom = document.createElement("div"); dom.className = "nm-note-raw"; dom.contentEditable = "false";
          const button = document.createElement("button"); button.type = "button"; button.textContent = "Nội dung Markdown nâng cao — mở nguồn";
          button.onclick = () => latest.current.onRaw(); dom.append(button); return { dom, stopEvent: () => true };
        },
      },
    });
    view.current = editor; return () => { editor.destroy(); view.current = null; };
  }, []);
  useEffect(() => {
    const editor = view.current;
    if (editor && props.value !== emitted.current) { emitted.current = props.value;
      // Loading a server snapshot is not an edit; preserve its document attributes too.
      editor.updateState(EditorState.create({ schema: noteSchema, doc: parseDocument(props.value), plugins: editor.state.plugins })); }
  }, [props.value]);
  useEffect(() => { view.current?.setProps({ editable: () => !busy }); }, [busy]);
  useEffect(() => { if (menu) popup.current?.querySelector<HTMLElement>("input,button,select")?.focus(); }, [menu]);
  const run = (command: Command) => { const editor = view.current; if (editor) { command(editor.state, editor.dispatch, editor); editor.focus(); } };
  const insertBlock = (node: ReturnType<typeof createTable>) => {
    const editor = view.current; if (!editor) return;
    const pos = blockAt.current ?? (editor.state.selection.$from.depth ? editor.state.selection.$from.after(1) : editor.state.selection.to); blockAt.current = null;
    const tr = editor.state.tr.insert(pos, [node, noteSchema.nodes.paragraph.create()]);
    editor.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1))).scrollIntoView()); close();
  };
  const insertImage = (file: DocumentMeta) => { const editor = view.current; if (!editor) return;
    editor.dispatch(editor.state.tr.replaceSelectionWith(noteSchema.nodes.image.create({ url: `document://${encodeURIComponent(file.id)}`, alt: file.originalName })).scrollIntoView()); close(); };
  return <div className="nm-visual-note">
    <NoteToolbar busy={busy} onBlockType={(level) => run(setBlockType(level ? noteSchema.nodes.heading : noteSchema.nodes.paragraph, level ? { level } : undefined))} handlers={{
      undo: () => run(undo), redo: () => run(redo),
      bold: () => run(toggleMark(noteSchema.marks.strong)), italic: () => run(toggleMark(noteSchema.marks.em)), underline: () => run(toggleMark(noteSchema.marks.underline)),
      highlight: () => open("highlight"),
      link: () => { setLabel(view.current?.state.doc.textBetween(view.current.state.selection.from, view.current.state.selection.to) ?? ""); setUrl(""); open("link"); },
      relation: () => { setQuery(""); open("relation"); },
      checklist: () => insertBlock(noteSchema.nodes.check_list.create(null, noteSchema.nodes.check_item.create(null, noteSchema.nodes.paragraph.create()))),
      table: () => open("table"), image: () => open("image"),
    }} />
    {menu && <div ref={popup} role="dialog" aria-modal="false" aria-label={`Chèn ${menu}`} className="nm-note-popover" onKeyDown={(event) => { if (event.key === "Escape" && !busy) { event.stopPropagation(); close(); opener.current?.focus(); } }}>
      <button type="button" aria-label="Đóng" className="nm-note-popup-close" disabled={busy} onClick={close}><X size={16} /></button>
      {menu === "highlight" && <div className="nm-note-colors">{Object.entries(highlightColors).map(([color, background]) => <button key={color} type="button" aria-label={`Highlight ${color}`} style={{ background }} onClick={() => { const editor = view.current!; editor.dispatch(editor.state.tr.addMark(editor.state.selection.from, editor.state.selection.to, noteSchema.marks.highlight.create({ color }))); close(); }}>{color}</button>)}
        <button type="button" onClick={() => { const editor = view.current!; editor.dispatch(editor.state.tr.removeMark(editor.state.selection.from, editor.state.selection.to, noteSchema.marks.highlight)); close(); }}>Xóa highlight</button></div>}
      {menu === "link" && <form onSubmit={(event) => { event.preventDefault(); if (!safeLink(url) || !label.trim()) { setError("Nhập tên và URL https://, http:// hoặc mailto: hợp lệ."); return; }
        const editor = view.current!; const { from, to, empty } = editor.state.selection; const mark = noteSchema.marks.link.create({ href: url });
        editor.dispatch(empty ? editor.state.tr.insertText(label, from, to).addMark(from, from + label.length, mark) : editor.state.tr.addMark(from, to, mark)); close(); }}>
        <label>Tên liên kết<input value={label} onChange={(e) => setLabel(e.target.value)} /></label><label>URL<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></label><button type="submit">Chèn Link</button></form>}
      {menu === "table" && <form onSubmit={(event) => { event.preventDefault(); try { insertBlock(createTable(rows, columns)); } catch { setError("Bảng cần 2–20 hàng và 1–8 cột."); } }}>
        <label>Hàng (gồm tiêu đề)<input type="number" min={2} max={20} value={rows} onChange={(e) => setRows(Number(e.target.value))} /></label><label>Cột<input type="number" min={1} max={8} value={columns} onChange={(e) => setColumns(Number(e.target.value))} /></label><button type="submit">Chèn bảng</button></form>}
      {menu === "relation" && <><label>Tìm Neuron<input value={query} onChange={(e) => setQuery(e.target.value)} /></label>{targets.map((neuron) => <button type="button" key={neuron.id} disabled={busy} onClick={async () => {
        if (busy) return; setBusy(true); try { await props.onEnsureConnection(neuron.id); const editor = view.current; if (editor) editor.dispatch(editor.state.tr.replaceSelectionWith(noteSchema.nodes.reference.create({ kind: "relation", id: neuron.id }))); close(); }
        catch { setError("Không tạo được liên kết. Vui lòng thử lại."); } finally { setBusy(false); }
      }}>{neuron.name}</button>)}{!targets.length && <p>Không có Neuron phù hợp.</p>}</>}
      {menu === "image" && <><label>Tải ảnh JPEG, PNG, WebP<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || !currentNeuron} onChange={async (event) => {
        const file = event.target.files?.[0]; if (!file || !currentNeuron) return; const problem = validateImageFile(file); if (problem) { setError(problem); return; }
        setBusy(true); setError(""); try { const uploaded = await uploadDocument(currentNeuron.subjectId, file); setAddedImages((images) => [...images, uploaded]); insertImage(uploaded); }
        catch { setError("Không tải ảnh lên được. Vui lòng thử lại."); } finally { setBusy(false); }
      }} /></label>{[...props.documents, ...addedImages].filter((d) => d.subjectId === currentNeuron?.subjectId && imageTypes.has(d.mimeType)).map((file) => <button type="button" key={file.id} disabled={busy} onClick={() => insertImage(file)}>{file.originalName}</button>)}{busy && <p role="status">Đang tải ảnh...</p>}</>}
      {menu === "insert" && <>{[0, 1, 2, 3].map((level) => <button type="button" key={level} onClick={() => insertBlock(level ? noteSchema.nodes.heading.create({ level }) : noteSchema.nodes.paragraph.create())}>{level ? `Heading ${level}` : "Paragraph"}</button>)}</>}
      {error && <p role="alert">{error}</p>}
    </div>}
    <div className="nm-note-content">
    <div className="nm-note-page" onMouseLeave={() => { if (!host.current?.contains(document.activeElement)) setHandle(null); }} onMouseMove={(event) => {
      const editor = view.current; if (!editor) return; const pos = editor.posAtCoords({ left: event.clientX, top: event.clientY }); if (!pos) return;
      const resolved = editor.state.doc.resolve(pos.pos); if (!resolved.depth) return; const dom = editor.nodeDOM(resolved.before(1)) as HTMLElement | null;
      if (dom) setHandle({ top: dom.getBoundingClientRect().top - event.currentTarget.getBoundingClientRect().top, pos: resolved.after(1) });
    }} onFocusCapture={() => { const editor = view.current; if (!editor) return; const selection = editor.state.selection.$from; if (selection.depth) {
      const dom = editor.nodeDOM(selection.before(1)) as HTMLElement | null; if (dom) setHandle({ top: dom.offsetTop, pos: selection.after(1) });
    } }}>
      {handle && <div className="nm-note-block-controls" style={{ top: handle.top }}><button type="button" aria-label="Thêm block bên dưới" onClick={() => { blockAt.current = handle.pos; open("insert"); }}><Plus size={14} /></button><span title="Block" aria-hidden="true"><GripVertical size={15} /></span></div>}
      <div ref={host} />
    </div>
    </div>
  </div>;
}
