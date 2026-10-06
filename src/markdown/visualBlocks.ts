export type BlockKind = "text" | "h1" | "h2" | "h3" | "bullet" | "number" | "check" | "quote" | "code" | "divider" | "raw";
export type NoteBlock = { start: number; end: number; raw: string; kind: BlockKind; text: string };
export const blockCommands: { kind: BlockKind; label: string }[] = [
  { kind: "text", label: "Text" }, { kind: "h1", label: "Heading 1" }, { kind: "h2", label: "Heading 2" },
  { kind: "h3", label: "Heading 3" }, { kind: "bullet", label: "Bullet list" }, { kind: "number", label: "Numbered list" },
  { kind: "check", label: "Checklist" }, { kind: "quote", label: "Quote" }, { kind: "code", label: "Code block" }, { kind: "divider", label: "Divider" },
];

function describe(raw: string): Pick<NoteBlock, "kind" | "text"> {
  // Unknown/nested constructs and custom references are atomic. Never normalize on mode switch.
  if (/\[\[(?:relation|document):|\r|^\s{2,}|^\[.*\]:|<|\||!\[/m.test(raw)) return { kind: "raw", text: raw };
  const heading = raw.match(/^(#{1,3}) (.*)$/);
  if (heading) return { kind: `h${heading[1].length}` as BlockKind, text: heading[2] };
  if (/^---$/.test(raw)) return { kind: "divider", text: "" };
  const code = raw.match(/^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n\1$/);
  if (code) return { kind: "code", text: code[3] };
  const lines = raw.split("\n");
  for (const [kind, pattern] of [["check", /^- \[[ xX]\] /], ["bullet", /^[-*+] /], ["number", /^\d+\. /], ["quote", /^> ?/]] as const) {
    if (lines.every((line) => pattern.test(line))) return { kind, text: lines.map((line) => line.replace(pattern, "")).join("\n") };
  }
  if (/^(?:#{1,6}\s|>|[-*+]\s|\d+[.)]\s|`{3,}|~{3,}|===+|---+)/m.test(raw)) return { kind: "raw", text: raw };
  return { kind: "text", text: raw };
}

/** Source offsets preserve every untouched byte, including whitespace and unsupported Markdown. */
export function parseNoteBlocks(value: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  let start = 0, position = 0, fence = "";
  const flush = (end: number) => {
    if (end > start) { const raw = value.slice(start, end); blocks.push({ start, end, raw, ...describe(raw) }); }
  };
  for (const line of value.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const delimiter = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (delimiter) {
      if (!fence) fence = delimiter[1];
      else if (delimiter[1][0] === fence[0] && delimiter[1].length >= fence.length && line.slice(line.indexOf(delimiter[1]) + delimiter[1].length).trim() === "") fence = "";
    }
    if (!fence && !line.trim()) { flush(position > start && value[position - 1] === "\n" ? position - 1 : position); start = position + line.length; }
    position += line.length;
  }
  flush(value.endsWith("\n") ? value.length - 1 : value.length);
  if (!blocks.length || /\n\s*\n\s*$/.test(value)) blocks.push({ start: value.length, end: value.length, raw: "", kind: "text", text: "" });
  return blocks;
}

export function formatBlock(kind: BlockKind, text: string, original?: NoteBlock): string {
  if (original && original.kind === kind && original.text === text) return original.raw;
  if (kind === "raw") return original?.raw ?? text;
  if (kind === "divider") return "---";
  if (kind === "code") {
    const old = original?.kind === "code" ? original.raw.match(/^(`{3,}|~{3,})([^\n]*)/) : null;
    const fence = "`".repeat(Math.max(3, ...Array.from(text.matchAll(/`+/g), (match) => match[0].length + 1)));
    return `${fence}${old?.[2] ?? ""}\n${text}\n${fence}`;
  }
  const prefixes: Partial<Record<BlockKind, string>> = { h1: "# ", h2: "## ", h3: "### ", bullet: "- ", quote: "> " };
  if (kind === "number") return text.split("\n").map((line, i) => `${i + 1}. ${line}`).join("\n");
  if (kind === "check") return text.split("\n").map((line, i) => `${original?.raw.split("\n")[i]?.match(/^- \[[ xX]\] /)?.[0] ?? "- [ ] "}${line}`).join("\n");
  return prefixes[kind] ? text.split("\n").map((line) => `${prefixes[kind]}${line}`).join("\n") : text;
}

export function replaceNoteBlock(value: string, block: NoteBlock, replacement: string) {
  return value.slice(0, block.start) + replacement + value.slice(block.end);
}
