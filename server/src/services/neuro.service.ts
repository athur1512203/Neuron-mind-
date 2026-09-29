import type { KnowledgeContext, KnowledgeSource } from "../knowledge/types";
import { knowledgeService } from "./knowledge.service";

export type NeuroChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type NeuroCitation = {
  type: KnowledgeSource["type"];
  sourceId: string;
  title: string;
  neuronId: string;
  subjectId: string;
};

export type NeuroChatResult = {
  neuronId: string;
  subjectId: string;
  reply: string;
  citations: NeuroCitation[];
  grounded: true;
};

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "is", "it",
  "of", "on", "or", "that", "the", "this", "to", "what", "when", "where", "which", "who", "why",
  "với", "của", "và", "là", "các", "những", "một", "trong", "cho", "được", "có", "không",
  "này", "kia", "thì", "về", "như", "hay", "hỏi", "giải", "thích",
]);

const MAX_PASSAGES = 3;
const MAX_PASSAGE_CHARS = 900;
const MAX_REPLY_CHARS = 4000;

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function splitPassages(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function scorePassage(passage: string, queryTokens: string[]): number {
  if (!queryTokens.length) return 0;
  const haystack = passage.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 1;
  }
  return score;
}

function cite(source: KnowledgeSource): NeuroCitation {
  return {
    type: source.type,
    sourceId: source.sourceId,
    title: source.title,
    neuronId: source.neuronId,
    subjectId: source.subjectId,
  };
}

function emptyReply(context: KnowledgeContext, reason: "empty" | "unmatched"): NeuroChatResult {
  const reply =
    reason === "empty"
      ? "Neuron này chưa có nội dung kiến thức để trả lời. Hãy thêm text hoặc markdown rồi hỏi lại."
      : "Tôi không tìm thấy đoạn kiến thức nào khớp câu hỏi trong neuron này. Hãy hỏi lại bằng từ khóa có trong ghi chú.";
  return {
    neuronId: context.neuronId,
    subjectId: context.subjectId,
    reply,
    citations: [],
    grounded: true,
  };
}

export function answerFromKnowledge(
  context: KnowledgeContext,
  message: string,
  history: NeuroChatMessage[] = [],
): NeuroChatResult {
  const usableSources = context.sources.filter((source) => typeof source.content === "string" && source.content.trim());
  if (!usableSources.length) return emptyReply(context, "empty");

  const historyUserText = history
    .filter((item) => item.role === "user")
    .slice(-4)
    .map((item) => item.content)
    .join(" ");
  const queryTokens = [...new Set(tokens(`${historyUserText} ${message}`))];

  const ranked: Array<{ source: KnowledgeSource; passage: string; score: number }> = [];
  for (const source of usableSources) {
    const passages = splitPassages(source.content ?? "");
    const chunks = passages.length ? passages : [source.content ?? ""];
    for (const passage of chunks) {
      ranked.push({ source, passage, score: scorePassage(passage, queryTokens) });
    }
  }
  ranked.sort((a, b) => b.score - a.score);

  const selected = ranked.filter((item) => item.score > 0).slice(0, MAX_PASSAGES);
  if (!selected.length) return emptyReply(context, "unmatched");

  const citations: NeuroCitation[] = [];
  const seen = new Set<string>();
  const sections: string[] = ["Dựa trên kiến thức đã lưu của neuron này:"];
  let used = sections[0].length;

  for (const item of selected) {
    const excerpt = item.passage.length > MAX_PASSAGE_CHARS
      ? `${item.passage.slice(0, MAX_PASSAGE_CHARS).trimEnd()}…`
      : item.passage;
    const block = `\n\n${excerpt}\n\nNguồn: ${item.source.title} (${item.source.type})`;
    if (used + block.length > MAX_REPLY_CHARS) break;
    sections.push(block);
    used += block.length;
    const key = `${item.source.type}:${item.source.sourceId}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push(cite(item.source));
    }
  }

  return {
    neuronId: context.neuronId,
    subjectId: context.subjectId,
    reply: sections.join(""),
    citations,
    grounded: true,
  };
}

export async function askNeuron(input: {
  neuronId: string;
  userId: string;
  message: string;
  history?: NeuroChatMessage[];
}): Promise<NeuroChatResult> {
  const context = await knowledgeService.getKnowledgeContext({
    neuronId: input.neuronId,
    userId: input.userId,
  });
  return answerFromKnowledge(context, input.message, input.history ?? []);
}
