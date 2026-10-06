import { aiErrorMessage, chatWithAI } from "../api/ai";

export type AgentState = "idle" | "listening" | "thinking" | "searching" | "answering" | "error";
export const agentLabels: Record<AgentState, string> = {
  idle: "Sẵn sàng", listening: "Đang nghe...", thinking: "Đang suy nghĩ...",
  searching: "Đang tìm trong NeuroMind...", answering: "Đang trả lời...", error: "Không thể kết nối với AI.",
};
type Message = { role: "user" | "assistant"; content: string };
type Snapshot = { state: AgentState; draft: string; messages: Message[]; error: string; busy: boolean };

/** In-memory, per-mounted-screen session. Only the current message goes to the API. */
export class AgentSession {
  private snapshot: Snapshot = { state: "idle", draft: "", messages: [], error: "", busy: false };
  private listeners = new Set<() => void>();
  private request?: AbortController;
  private answerTimer?: ReturnType<typeof setTimeout>;
  constructor(private readonly send = chatWithAI, private readonly timeoutMs = 110000) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  setDraft = (draft: string) => this.update({ draft: draft.slice(0, 8000) });
  listen = () => { if (!this.snapshot.busy) { clearTimeout(this.answerTimer); this.update({ state: "listening", error: "" }); } };
  stopListening = () => { if (this.snapshot.state === "listening") this.update({ state: "idle" }); };
  voiceError = () => this.update({ state: "idle", error: "Không thể dùng micro. Hãy kiểm tra quyền truy cập hoặc nhập bằng bàn phím." });
  submit = async () => {
    const message = this.snapshot.draft.trim();
    if (!message || this.snapshot.busy || this.snapshot.state === "listening") return;
    clearTimeout(this.answerTimer);
    const controller = new AbortController();
    this.request = controller;
    this.update({ draft: "", busy: true, error: "", state: "thinking",
      messages: [...this.snapshot.messages, { role: "user", content: message }] });
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const answer = await this.send(message, controller.signal);
      if (this.request !== controller) return;
      this.update({ state: "answering", messages: [...this.snapshot.messages, { role: "assistant", content: answer }] });
      this.answerTimer = setTimeout(() => this.update({ state: "idle" }), 900);
    } catch (error) {
      if (this.request !== controller) return;
      this.update({ state: "error", draft: message, error: controller.signal.aborted
        ? "AI phản hồi quá lâu. Vui lòng thử lại." : aiErrorMessage(error) });
    } finally {
      clearTimeout(timer);
      if (this.request === controller) { this.request = undefined; this.update({ busy: false }); }
    }
  };
  dispose = () => {
    this.request?.abort(); this.request = undefined;
    clearTimeout(this.answerTimer);
  };
}

export function shouldSend(event: { key: string; shiftKey: boolean; isComposing: boolean }) {
  return event.key === "Enter" && !event.shiftKey && !event.isComposing;
}
