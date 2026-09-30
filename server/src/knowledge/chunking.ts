export interface MarkdownChunk {
  heading: string;
  content: string;
}

/** Keep heading sections together; unheaded text uses blank-line blocks.
 * Newlines inside blocks are retained, so related sentences stay together.
 */
export function chunkMarkdown(content: string): MarkdownChunk[] {
  const chunks: MarkdownChunk[] = [];
  const headings: string[] = [];
  let lines: string[] = [];
  let fence: string | undefined;
  const flush = () => {
    const text = lines.join("\n").trim();
    if (text) chunks.push({ heading: headings.filter(Boolean).join(" / "), content: text });
    lines = [];
  };
  for (const line of content.replace(/\r\n?/g, "\n").split("\n")) {
    const delimiter = line.match(/^\s*(`{3,}|~{3,})/);
    if (delimiter) {
      if (!fence) fence = delimiter[1];
      else if (delimiter[1][0] === fence[0] && delimiter[1].length >= fence.length) fence = undefined;
      lines.push(line);
      continue;
    }
    const heading = !fence && line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flush();
      headings.length = heading[1].length;
      headings[heading[1].length - 1] = heading[2];
    } else if (!fence && !headings.length && !line.trim()) {
      flush();
    } else {
      lines.push(line);
    }
  }
  flush();
  return chunks;
}
