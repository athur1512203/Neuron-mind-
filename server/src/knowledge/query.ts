export type RetrievalQuery = {
  original: string;
  template: string;
  knownTerms: string[];
};

// Frozen compatibility fallback only; recognized templates do not use this list.
const LEGACY_QUESTION_WORDS = new Set([
  "ai", "gì", "nào", "mấy", "bao", "nhiêu", "ở", "đâu", "khi", "như", "thế",
  "cho", "tôi", "biết", "hãy", "vui", "lòng", "là", "của", "có", "không", "và", "hay",
  "được", "này", "trong", "với", "thì", "về", "các", "những", "một",
  "who", "what", "when", "where", "why", "how", "is", "are", "the", "of", "to", "and",
]);

export function normalize(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
}

function legacyTokens(text: string): string[] {
  return normalize(text).split(/\s+/).filter((token) => token && !LEGACY_QUESTION_WORDS.has(token));
}


export function extractKnownTerms(template: string): string[] {
  return normalize(template).split(/\s+/).filter(Boolean);
}

export function buildRetrievalTemplate(original: string): RetrievalQuery {
  const clean = original.normalize("NFC").replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
  const words = clean ? clean.split(/\s+/) : [];
  const lower = words.map((word) => word.toLowerCase());
  const spans: Array<{ start: number; length: number }> = [];
  const phrases = ["như thế nào", "bao nhiêu", "khi nào", "ở đâu", "thế nào", "nào của"];
  for (let index = 0; index < lower.length; index++) {
    const phrase = phrases.find((value) => lower.slice(index, index + value.split(" ").length).join(" ") === value);
    const length = phrase ? phrase.split(" ").length :
      ((lower[index] === "ai" && index === 0) ||
       (["gì", "nào", "đâu"].includes(lower[index]) && index === lower.length - 1) ? 1 : 0);
    if (length) {
      spans.push({ start: index, length });
      index += length - 1;
    }
  }
  // Avoid guessing at multiple questions, negated/indefinite interrogatives or quoted terms.
  const uncertain = lower.some((word) => ["không", "bất", "cũng"].includes(word)) || /["“”‘’]/u.test(original);
  if (spans.length !== 1 || uncertain) {
    return { original, template: normalize(original), knownTerms: legacyTokens(original) };
  }
  const { start, length } = spans[0];
  const template = [...words.slice(0, start), "...", ...words.slice(start + length)].join(" ");
  return { original, template, knownTerms: extractKnownTerms(template) };
}
