import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, Mic, Square } from "lucide-react";
import { AgentSession, agentLabels, shouldSend } from "./ai-session";
import "./ai-agent.css";

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

function AgentAvatar() {
  return <div className="nm-agent-avatar" aria-hidden="true">
    <div className="nm-agent-halo" />
    <svg viewBox="0 0 240 210" className="nm-agent-robot">
      <path d="M120 40V25" stroke="#c8bbae" strokeWidth="5" strokeLinecap="round" />
      <circle cx="120" cy="22" r="7" fill="#8b1e24" />
      <rect x="26" y="85" width="20" height="45" rx="10" fill="#e5ddd0" />
      <rect x="194" y="85" width="20" height="45" rx="10" fill="#e5ddd0" />
      <rect x="39" y="43" width="162" height="130" rx="58" fill="#fffdf8" stroke="#d9cfc1" strokeWidth="2" />
      <path d="M68 63Q120 45 171 63" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <rect x="57" y="78" width="126" height="66" rx="28" fill="#30272b" />
      <g className="nm-agent-eyes" fill="#ed9da9">
        <rect x="82" y="98" width="15" height="22" rx="7.5" />
        <rect x="143" y="98" width="15" height="22" rx="7.5" />
      </g>
      <path d="M111 128Q120 133 129 128" fill="none" stroke="#bcb0b5" strokeWidth="2" strokeLinecap="round" />
    </svg>
    <div className="nm-agent-shadow" />
  </div>;
}

export function AIAgent() {
  const [session] = useState(() => new AgentSession());
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const { state, draft, messages, error, busy } = snapshot;
  const recognition = useRef<Recognition | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const Speech = typeof window === "undefined" ? undefined :
    ((window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition);

  useEffect(() => () => {
    session.dispose();
    if (recognition.current) {
      recognition.current.onresult = null; recognition.current.onend = null; recognition.current.onerror = null;
      recognition.current.abort();
    }
  }, [session]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages, error]);

  const toggleVoice = () => {
    if (!Speech || busy) return;
    if (state === "listening") { recognition.current?.stop(); return; }
    const speech = new Speech();
    recognition.current = speech;
    const prefix = draft.trim();
    speech.lang = "vi-VN"; speech.continuous = false; speech.interimResults = false;
    speech.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0].transcript).join(" ");
      session.setDraft([prefix, text].filter(Boolean).join(" "));
    };
    speech.onend = () => { session.stopListening(); input.current?.focus(); };
    speech.onerror = session.voiceError;
    try { speech.start(); session.listen(); } catch { session.voiceError(); }
  };

  return <main className={`nm-agent ${messages.length ? "is-conversation" : ""}`} data-state={state} aria-label="AI Agent">
    <header className="nm-agent-identity">
      <AgentAvatar />
      <h1>JARVIS</h1>
      <p>NeuroMind AI Agent</p>
      <div className="nm-agent-status" role="status"><span />{agentLabels[state]}</div>
    </header>
    {messages.length > 0 && <section className="nm-agent-conversation" aria-label="Cuộc trò chuyện" role="log" aria-live="polite" aria-relevant="additions">
      {messages.map((message, index) => <div key={index} className={`nm-agent-message is-${message.role}`}>
        <span className="nm-agent-author">{message.role === "user" ? "Bạn" : "JARVIS"}</span>
        <p>{message.content}</p>
      </div>)}
      <div ref={end} />
    </section>}
    <div className="nm-agent-command">
      {error && <p className="nm-agent-error" role="alert">{error}</p>}
      <form className="nm-agent-input" onSubmit={(event) => { event.preventDefault(); void session.submit(); }}>
        <button type="button" className="nm-agent-mic" aria-label={state === "listening" ? "Dừng nhập giọng nói" : "Nhập giọng nói"}
          title={Speech ? "Nhập giọng nói" : "Trình duyệt chưa hỗ trợ nhập giọng nói"}
          disabled={!Speech || busy} aria-pressed={state === "listening"} onClick={toggleVoice}>
          {state === "listening" ? <Square size={17} /> : <Mic size={20} />}
        </button>
        <textarea ref={input} rows={2} maxLength={8000} aria-label="Yêu cầu cho NeuroMind" placeholder="Nhập yêu cầu cho NeuroMind..."
          value={draft} readOnly={busy || state === "listening"} onChange={(event) => session.setDraft(event.target.value)}
          onKeyDown={(event) => { if (shouldSend({ key: event.key, shiftKey: event.shiftKey, isComposing: event.nativeEvent.isComposing })) {
            event.preventDefault(); void session.submit();
          } }} />
        <button type="submit" className="nm-agent-send" aria-label="Gửi yêu cầu" disabled={!draft.trim() || busy || state === "listening"}><ArrowUp size={20} /></button>
      </form>
      <p className="nm-agent-hint">{Speech ? "Enter để gửi · Shift+Enter để xuống dòng" : "Trình duyệt chưa hỗ trợ nhập giọng nói"}</p>
    </div>
  </main>;
}
