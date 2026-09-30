/** V0 passages are independent, non-empty lines; preserve their original text. */
export function splitPassages(content: string): string[] {
  return content.replace(/\r\n?/g, "\n").split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
