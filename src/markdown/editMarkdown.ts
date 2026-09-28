export type EditorRange = {
  value: string;
  start: number;
  end: number;
};

function splice(value: string, start: number, end: number, insert: string): string {
  return `${value.slice(0, start)}${insert}${value.slice(end)}`;
}

function selectedLineBounds(value: string, start: number, end: number) {
  const from = value.lastIndexOf("\n", start - 1) + 1;
  const last = Math.max(start, end - (end > start && value[end - 1] === "\n" ? 1 : 0));
  const newline = value.indexOf("\n", last);
  const to = newline === -1 ? value.length : newline;
  return { from, to };
}

export function wrapMarkers(range: EditorRange, before: string, after = before): EditorRange {
  const selected = range.value.slice(range.start, range.end);
  if (!selected) {
    const insert = `${before}${after}`;
    return {
      value: splice(range.value, range.start, range.end, insert),
      start: range.start + before.length,
      end: range.start + before.length,
    };
  }
  const insert = `${before}${selected}${after}`;
  return {
    value: splice(range.value, range.start, range.end, insert),
    start: range.start + before.length,
    end: range.start + before.length + selected.length,
  };
}

export function prefixSelectedLines(range: EditorRange, prefix: string): EditorRange {
  const { from, to } = selectedLineBounds(range.value, range.start, range.end);
  const block = range.value.slice(from, to);
  const next = block
    .split("\n")
    .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
    .join("\n");
  return {
    value: splice(range.value, from, to, next),
    start: from,
    end: from + next.length,
  };
}

export function insertAtCursor(range: EditorRange, insert: string, cursorOffset: number): EditorRange {
  const value = splice(range.value, range.start, range.end, insert);
  const position = range.start + cursorOffset;
  return { value, start: position, end: position };
}

export function insertLink(range: EditorRange): EditorRange {
  const selected = range.value.slice(range.start, range.end);
  if (!selected) {
    return insertAtCursor(range, "[](https://)", 1);
  }
  const insert = `[${selected}](https://)`;
  return insertAtCursor({ ...range, end: range.end }, insert, 1 + selected.length + 2);
}

export function insertCodeBlock(range: EditorRange): EditorRange {
  const selected = range.value.slice(range.start, range.end);
  const insert = `\`\`\`text\n${selected}\n\`\`\``;
  return insertAtCursor(range, insert, "```text\n".length + selected.length);
}

export function insertTable(range: EditorRange): EditorRange {
  const atLineStart = range.start === 0 || range.value[range.start - 1] === "\n";
  const insert = `${atLineStart ? "" : "\n"}| Cột 1 | Cột 2 |\n| --- | --- |\n| | |\n`;
  return insertAtCursor(range, insert, insert.length);
}
