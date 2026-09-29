import { MessageCircle, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { askNeuronChat, type NeuroChatTurn } from "../api/chat";
import { apiMessage } from "../api/client";

type NeuronChatProps = {
  neuronId: string;
  neuronName: string;
};

export function NeuronChat({ neuronId, neuronName }: NeuronChatProps) {
  const [turns, setTurns] = useState<NeuroChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTurns([]);
    setDraft("");
    setError("");
  }, [neuronId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [turns, sending]);

  const send = async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setDraft("");
    setError("");
    setSending(true);
    const nextTurns = [...turns, { role: "user" as const, content: message }];
    setTurns(nextTurns);
    try {
      const result = await askNeuronChat(neuronId, message, turns);
      const content = result.found && result.answer
        ? result.answer
        : "Không tìm thấy thông tin liên quan trong kiến thức của neuron này.";
      setTurns([...nextTurns, { role: "assistant", content }]);
    } catch (caught) {
      setError(apiMessage(caught, "Không gửi được câu hỏi."));
      setTurns(turns);
      setDraft(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="neuron-chat" aria-label="Neuro Chat">
      <header className="neuron-chat-header">
        <span className="brutal-icon" aria-hidden="true"><MessageCircle size={16} /></span>
        <div>
          <h3>Neuro Chat</h3>
          <p>Hỏi nội dung đã lưu của neuron {neuronName}. Câu trả lời chỉ lấy từ kiến thức của neuron này.</p>
        </div>
      </header>

      <div ref={listRef} className="neuron-chat-log">
        {turns.length === 0 && !sending ? (
          <p className="neuron-chat-empty">Ví dụ: “Điểm chính là gì?” hoặc một từ khóa có trong ghi chú.</p>
        ) : null}
        {turns.map((turn, index) => (
          <article key={`${turn.role}-${index}`} className={`neuron-chat-bubble is-${turn.role}`}>
            <p>{turn.content}</p>
          </article>
        ))}
        {sending ? <p className="neuron-chat-status">Đang tìm trong kiến thức…</p> : null}
      </div>

      {error ? <p className="neuron-chat-error">{error}</p> : null}

      <form
        className="neuron-chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <textarea
          id={`neuron-chat-${neuronId}`}
          aria-label="Câu hỏi Neuro Chat"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={2}
          maxLength={4000}
          placeholder="Hỏi về neuron này…"
          disabled={sending}
        />
        <button type="submit" className="brutal-button brutal-button-primary" disabled={sending || !draft.trim()}>
          <Send size={15} />Gửi
        </button>
      </form>
    </section>
  );
}
