import { Fragment, type ReactNode } from "react";
import { Undo2, Redo2, Bold, Italic, Underline, Highlighter, List, ListOrdered, ListChecks, Quote, Code, SquareCode, Link, Network, Table, Image } from "lucide-react";
import "./note-toolbar.css";

const actions = {
  undo: [Undo2, "Hoàn tác"], redo: [Redo2, "Làm lại"],
  bold: [Bold, "In đậm"], italic: [Italic, "In nghiêng"], underline: [Underline, "Gạch chân"], highlight: [Highlighter, "Tô sáng"],
  bullet: [List, "Danh sách"], ordered: [ListOrdered, "Danh sách số"], checklist: [ListChecks, "Checklist"],
  quote: [Quote, "Trích dẫn"], code: [Code, "Code"], codeBlock: [SquareCode, "Khối code"],
  link: [Link, "Chèn liên kết"], relation: [Network, "Liên kết neuron"], table: [Table, "Chèn bảng"], image: [Image, "Chèn ảnh"],
} as const;
export type NoteToolbarAction = keyof typeof actions;
const groups: NoteToolbarAction[][] = [["undo", "redo"], ["bold", "italic", "underline", "highlight"], ["bullet", "ordered", "checklist"], ["quote", "code", "codeBlock"], ["link", "relation"], ["table", "image"]];

export function NoteToolbar({ handlers, disabled = [], busy = false, onBlockType, paragraphSupported = true, popovers = {} }: {
  handlers: Partial<Record<NoteToolbarAction, () => void>>;
  disabled?: NoteToolbarAction[];
  busy?: boolean;
  onBlockType: (level: number) => void;
  paragraphSupported?: boolean;
  popovers?: Partial<Record<NoteToolbarAction, ReactNode>>;
}) {
  return <div className="nm-shared-toolbar" role="toolbar" aria-label="Định dạng ghi chú">
    {groups.map((group, index) => <Fragment key={index}>
      {index > 0 && <span className="nm-toolbar-divider" role="separator" aria-orientation="vertical" />}
      {index === 1 && <>
        <select aria-label="Kiểu đoạn văn" defaultValue="0" disabled={busy} onChange={(event) => onBlockType(Number(event.target.value))}>
          <option value="0" disabled={!paragraphSupported}>Paragraph</option>
          <option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option>
        </select>
        <span className="nm-toolbar-divider" role="separator" aria-orientation="vertical" />
      </>}
      {group.map((action) => {
        const [Icon, label] = actions[action];
        return <span className="nm-toolbar-slot" key={action}>
          <button type="button" title={label} aria-label={label} disabled={busy || !handlers[action] || disabled.includes(action)} onMouseDown={(event) => event.preventDefault()} onClick={handlers[action]}><Icon size={17} /></button>
          {popovers[action]}
        </span>;
      })}
    </Fragment>)}
  </div>;
}
