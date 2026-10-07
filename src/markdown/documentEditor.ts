import { Schema, type Node as PMNode, type Mark } from "prosemirror-model";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";

export const highlightColors = { yellow: "#fff1b8", pink: "#f7dce1", blue: "#dcebf8", green: "#dceedd" };
const sourceAttrs = { original: { default: null }, stamp: { default: null }, before: { default: null } };
export const noteSchema = new Schema({
  nodes: {
    doc: { content: "block+", attrs: { tail: { default: "" } } },
    paragraph: { group: "block", content: "inline*", attrs: sourceAttrs, toDOM: () => ["p", 0], parseDOM: [{ tag: "p" }] },
    heading: { group: "block", content: "inline*", attrs: { ...sourceAttrs, level: { default: 1 } },
      toDOM: (node) => [`h${node.attrs.level}`, 0], parseDOM: [1, 2, 3].map((level) => ({ tag: `h${level}`, attrs: { level } })) },
    text: { group: "inline" },
    hard_break: { inline: true, group: "inline", selectable: false, toDOM: () => ["br"], parseDOM: [{ tag: "br" }] },
    reference: { inline: true, group: "inline", atom: true, marks: "", attrs: { kind: {}, id: {} },
      toDOM: () => ["span", { class: "neuron-md-ref-chip", contenteditable: "false" }, "Liên kết"] },
    image: { inline: true, group: "inline", atom: true, marks: "", attrs: { url: {}, alt: { default: "" } },
      toDOM: (node) => ["span", { class: "nm-note-image", contenteditable: "false" }, node.attrs.alt || "Ảnh"] },
    check_list: { group: "block", content: "check_item+", attrs: sourceAttrs, toDOM: () => ["div", { class: "nm-check-list" }, 0] },
    check_item: { content: "paragraph", attrs: { checked: { default: false } }, toDOM: () => ["div", { class: "nm-check-item" }, 0] },
    table: { group: "block", content: "table_row+", attrs: { ...sourceAttrs, align: { default: [] } }, isolating: true,
      toDOM: () => ["table", ["tbody", 0]] },
    table_row: { content: "table_cell+", toDOM: () => ["tr", 0] },
    table_cell: { content: "inline*", isolating: true, toDOM: () => ["td", 0], parseDOM: [{ tag: "td" }, { tag: "th" }] },
    raw: { group: "block", atom: true, attrs: { ...sourceAttrs, content: { default: "" } }, toDOM: () => ["div", { class: "nm-note-raw" }, "Markdown nâng cao"] },
  },
  marks: {
    strong: { toDOM: () => ["strong", 0], parseDOM: [{ tag: "strong" }, { tag: "b" }] },
    em: { toDOM: () => ["em", 0], parseDOM: [{ tag: "em" }, { tag: "i" }] },
    underline: { toDOM: () => ["u", 0], parseDOM: [{ tag: "u" }] },
    highlight: { attrs: { color: { default: "yellow" } }, toDOM: (mark) => ["mark", { style: `background-color:${highlightColors[mark.attrs.color as keyof typeof highlightColors] ?? highlightColors.yellow}` }, 0] },
    code: { code: true, excludes: "_", toDOM: () => ["code", 0], parseDOM: [{ tag: "code" }] },
    link: { attrs: { href: {} }, inclusive: false, toDOM: (mark) => ["a", { href: safeLink(mark.attrs.href) ? mark.attrs.href : undefined, rel: "noopener noreferrer" }, 0] },
  },
});

export function safeLink(url: string) { return /^(https?:\/\/|mailto:)/i.test(url) && !/[\u0000-\u0020]/.test(url); }
type AST = { type: string; value?: string; children?: AST[]; depth?: number; checked?: boolean | null; url?: string; alt?: string; title?: string | null; align?: (string | null)[];
  position?: { start: { offset: number }; end: { offset: number } } };
const parser = unified().use(remarkParse).use(remarkGfm);

function inline(nodes: AST[], marks: Mark[] = []): PMNode[] {
  return nodes.flatMap((node): PMNode[] => {
    if (node.type === "text") {
      const result: PMNode[] = []; const text = node.value ?? "";
      let from = 0;
      for (const match of text.matchAll(/\[\[(relation|document):([^\]\s]+)\]\]/g)) {
        if (match.index! > from) result.push(noteSchema.text(text.slice(from, match.index), marks));
        result.push(noteSchema.nodes.reference.create({ kind: match[1], id: match[2] })); from = match.index! + match[0].length;
      }
      if (from < text.length) result.push(noteSchema.text(text.slice(from), marks));
      return result;
    }
    if (node.type === "break") return [noteSchema.nodes.hard_break.create()];
    if (node.type === "inlineCode") return node.value ? [noteSchema.text(node.value, [noteSchema.marks.code.create()])] : [];
    if (node.type === "image") {
      if (node.title || !(/^(document:\/\/[^\s]+)$/.test(node.url ?? "") || safeLink(node.url ?? ""))) throw new Error("Preserve image source");
      return [noteSchema.nodes.image.create({ url: node.url, alt: node.alt ?? "" })];
    }
    const type = node.type === "strong" ? "strong" : node.type === "emphasis" ? "em" : node.type === "link" ? "link" : null;
    if (!type) throw new Error("Preserve unsupported inline source");
    let mark: Mark;
    if (type === "link") {
      if (node.title) throw new Error("Preserve link title");
      const color = node.url?.match(/^nm-highlight:(yellow|pink|blue|green)$/)?.[1];
      if (color) mark = noteSchema.marks.highlight.create({ color });
      else if (node.url === "nm-underline:") mark = noteSchema.marks.underline.create();
      else if (safeLink(node.url ?? "")) mark = noteSchema.marks.link.create({ href: node.url });
      else throw new Error("Preserve unsafe or unsupported URL");
    } else mark = noteSchema.marks[type].create();
    return inline(node.children ?? [], [...marks, mark]);
  });
}

function fingerprint(node: PMNode): string {
  const clean = (n: PMNode): unknown => ({ type: n.type.name, attrs: Object.fromEntries(Object.entries(n.attrs).filter(([key]) => !["original", "stamp", "before"].includes(key))),
    text: n.text, marks: n.marks.map((mark) => mark.toJSON()), children: Array.from({ length: n.childCount }, (_, i) => clean(n.child(i))) });
  return JSON.stringify(clean(node));
}

export function parseDocument(markdown: string): PMNode {
  const ast = parser.parse(markdown) as unknown as AST; let end = 0;
  const children = (ast.children ?? []).map((node) => {
    const start = node.position!.start.offset, stop = node.position!.end.offset;
    const raw = markdown.slice(start, stop), before = markdown.slice(end, start); end = stop;
    let result: PMNode;
    try {
      if (node.type === "paragraph") result = noteSchema.nodes.paragraph.create(null, inline(node.children ?? []));
      else if (node.type === "heading" && node.depth! <= 3) result = noteSchema.nodes.heading.create({ level: node.depth }, inline(node.children ?? []));
      else if (node.type === "list" && node.children?.every((item) => typeof item.checked === "boolean" && item.children?.length === 1 && item.children[0].type === "paragraph")) {
        result = noteSchema.nodes.check_list.create(null, node.children.map((item) => noteSchema.nodes.check_item.create({ checked: item.checked },
          noteSchema.nodes.paragraph.create(null, inline(item.children![0].children ?? [])))));
      } else if (node.type === "table") result = noteSchema.nodes.table.create({ align: node.align }, node.children?.map((row) => noteSchema.nodes.table_row.create(null,
        row.children?.map((cell) => noteSchema.nodes.table_cell.create(null, inline(cell.children ?? []))))));
      else throw new Error("Preserve raw block");
    } catch { result = noteSchema.nodes.raw.create({ content: raw }); }
    return result.type.create({ ...result.attrs, before, original: raw, stamp: fingerprint(result) }, result.content);
  });
  return noteSchema.nodes.doc.create({ tail: markdown.slice(end) }, children.length ? children : [noteSchema.nodes.paragraph.create()]);
}

function escapeText(text: string) { return text.replace(/([\\`*_[\]<>~])/g, "\\$1").replace(/\n/g, "  \n"); }
export function serializeInline(node: PMNode): string {
  let output = "";
  node.forEach((child) => {
    if (child.type.name === "reference") { output += `[[${child.attrs.kind}:${child.attrs.id}]]`; return; }
    if (child.type.name === "image") { output += `![${escapeText(child.attrs.alt)}](${child.attrs.url})`; return; }
    if (child.type.name === "hard_break") { output += "  \n"; return; }
    let text = escapeText(child.text ?? "");
    for (const mark of [...child.marks].reverse()) {
      if (mark.type.name === "code") { const fence = "`".repeat(Math.max(1, ...Array.from((child.text ?? "").matchAll(/`+/g), (m) => m[0].length + 1))); text = `${fence} ${child.text} ${fence}`; }
      if (mark.type.name === "strong") text = `**${text}**`;
      if (mark.type.name === "em") text = `*${text}*`;
      if (mark.type.name === "underline") text = `[${text}](nm-underline:)`;
      if (mark.type.name === "highlight") text = `[${text}](nm-highlight:${mark.attrs.color})`;
      if (mark.type.name === "link") text = `[${text}](${mark.attrs.href.replace(/\(/g, "%28").replace(/\)/g, "%29")})`;
    }
    output += text;
  });
  return output;
}

export function serializeDocument(doc: PMNode): string {
  let result = "";
  doc.forEach((node, _offset, index) => {
    const unchanged = node.attrs.original !== null && node.attrs.stamp === fingerprint(node);
    const before = node.attrs.before !== null ? node.attrs.before : index ? "\n\n" : "";
    result += index && !before ? "\n\n" : before;
    if (unchanged) { result += node.attrs.original; return; }
    switch (node.type.name) {
      case "paragraph": result += serializeInline(node).replace(/^(#{1,6}|[-+>]|\d+\.) /, "\\$1 "); break;
      case "heading": result += `${"#".repeat(node.attrs.level)} ${serializeInline(node)}`; break;
      case "check_list": node.forEach((item, _p, i) => { result += `${i ? "\n" : ""}- [${item.attrs.checked ? "x" : " "}] ${serializeInline(item.firstChild!)}`; }); break;
      case "table": {
        const rows: string[][] = []; node.forEach((row) => { const cells: string[] = []; row.forEach((cell) => cells.push(serializeInline(cell).replace(/\|/g, "\\|").replace(/  \n/g, " "))); rows.push(cells); });
        const row = (cells: string[]) => `| ${cells.join(" | ")} |`;
        const align = rows[0].map((_cell, i) => node.attrs.align?.[i] === "center" ? ":---:" : node.attrs.align?.[i] === "right" ? "---:" : node.attrs.align?.[i] === "left" ? ":---" : "---");
        result += [row(rows[0]), row(align), ...rows.slice(1).map(row)].join("\n"); break;
      }
      case "raw": result += node.attrs.content; break;
    }
  });
  return result + doc.attrs.tail;
}

export function createTable(rows: number, columns: number) {
  if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 2 || rows > 20 || columns < 1 || columns > 8) throw new Error("Invalid table size");
  return noteSchema.nodes.table.create(null, Array.from({ length: rows }, (_, r) => noteSchema.nodes.table_row.create(null,
    Array.from({ length: columns }, (_, c) => noteSchema.nodes.table_cell.create(null, r === 0 ? noteSchema.text(String.fromCharCode(65 + c)) : undefined)))));
}
