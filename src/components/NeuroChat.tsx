import { ArrowUp, Code2, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ApiError } from "../api/client";
import {
  debugSearchCore,
  type RetrievedDebugItem,
  type RetrievedInformation,
  type SearchDebugRequest,
} from "../api/search";

const PLANNER_NOTICE = "Neuro AI planner chưa được kết nối.";

type ChatTurn =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "note"; text: string }
  | { id: string; role: "error"; text: string }
  | { id: string; role: "search"; result: RetrievedInformation };

type NeuroChatProps = {
  open: boolean;
  onClose: () => void;
};

function stripClientUserId(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { userId: _ignored, ...rest } = value as Record<string, unknown>;
  return rest;
}

function formatScore(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(2);
}

function SearchHit({ item }: { item: RetrievedDebugItem }) {
  const space = item.subjectName ? `${item.subjectName}` : item.subjectId;
  const neuron = item.title || item.neuronId;
  return (
    <article className="neuro-chat-hit">
      <p className="neuro-chat-hit-meta">
        Space: {space}
        <br />
        Neuron: {neuron}
        <br />
        Source: {item.sourceType}
        {item.heading ? (
          <>
            <br />
            Heading: {item.heading}
          </>
        ) : null}
      </p>
      <p className="neuro-chat-hit-body">{item.content || item.snippet || ""}</p>
      <p className="neuro-chat-hit-score">Score: {formatScore(item.score)}</p>
    </article>
  );
}

function SearchResultView({ result }: { result: RetrievedInformation }) {
  const [rawOpen, setRawOpen] = useState(false);
  return (
    <div className="neuro-chat-search">
      <p className="neuro-chat-search-title">Search Core</p>
      {result.requests.map((request) => (
        <section key={request.requestId} className="neuro-chat-request">
          <p className="neuro-chat-request-head">
            {request.requestId}
            <span>{request.found ? "✓ Found" : "NOT FOUND"}</span>
          </p>
          <p className="neuro-chat-request-query">{request.query}</p>
          {request.results.map((item) => (
            <SearchHit key={item.id} item={item} />
          ))}
        </section>
      ))}
      <button type="button" className="neuro-chat-raw-toggle" onClick={() => setRawOpen((open) => !open)}>
        {rawOpen ? "Hide raw JSON" : "Raw JSON"}
      </button>
      {rawOpen ? <pre className="neuro-chat-raw">{JSON.stringify(result, null, 2)}</pre> : null}
    </div>
  );
}

export function NeuroChat({ open, onClose }: NeuroChatProps) {
  const [mode, setMode] = useState<"chat" | "script">("chat");
  const [draft, setDraft] = useState("");
  const [script, setScript] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => composerRef.current?.focus(), 0);
  }, [open, mode]);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [turns, busy, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const push = (turn: ChatTurn) => {
    setTurns((current) => [...current, turn]);
  };

  const uid = () => {
    nextId.current += 1;
    return String(nextId.current);
  };

  const sendChat = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    push({ id: uid(), role: "user", text });
    push({ id: uid(), role: "note", text: PLANNER_NOTICE });
  };

  const runScript = async () => {
    const text = script.trim();
    if (!text || busy) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      push({
        id: uid(),
        role: "error",
        text: `INVALID JSON${error instanceof SyntaxError ? `: ${error.message}` : ""}`,
      });
      return;
    }
    push({ id: uid(), role: "user", text });
    setBusy(true);
    try {
      const result = await debugSearchCore(stripClientUserId(parsed) as SearchDebugRequest);
      push({ id: uid(), role: "search", result });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        push({ id: uid(), role: "error", text: "Search Core debug endpoint is disabled." });
      } else if (error instanceof ApiError && error.status === 401) {
        push({ id: uid(), role: "error", text: "Authentication required" });
      } else if (error instanceof ApiError && error.status === 400) {
        push({ id: uid(), role: "error", text: "SearchPlan validation failed" });
      } else if (error instanceof ApiError) {
        push({ id: uid(), role: "error", text: `${error.status}: ${error.message}` });
      } else {
        push({ id: uid(), role: "error", text: "Request failed" });
      }
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (mode === "chat") sendChat();
    else void runScript();
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mode === "chat" && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendChat();
      return;
    }
    if (mode === "script" && (event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void runScript();
    }
  };

  if (!open) return null;

  const value = mode === "chat" ? draft : script;
  const setValue = mode === "chat" ? setDraft : setScript;

  return (
    <div className="neuro-chat-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="neuro-chat-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Neuro Chat"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="neuro-chat-top">
          <h2>Neuro</h2>
          <button type="button" className="brutal-icon-button" onClick={onClose} aria-label="Đóng Neuro Chat">
            <X size={16} />
          </button>
        </header>

        <div ref={logRef} className="neuro-chat-log">
          {turns.length === 0 ? (
            <p className="neuro-chat-empty">Hỏi Neuro hoặc dán SearchPlan JSON ở chế độ Script.</p>
          ) : null}
          {turns.map((turn) => {
            if (turn.role === "user") {
              return (
                <article key={turn.id} className="neuro-chat-bubble is-user">
                  <p>{turn.text}</p>
                </article>
              );
            }
            if (turn.role === "note") {
              return (
                <article key={turn.id} className="neuro-chat-bubble is-assistant">
                  <p>{turn.text}</p>
                </article>
              );
            }
            if (turn.role === "error") {
              return (
                <article key={turn.id} className="neuro-chat-bubble is-error">
                  <p>{turn.text}</p>
                </article>
              );
            }
            return (
              <article key={turn.id} className="neuro-chat-bubble is-assistant">
                <SearchResultView result={turn.result} />
              </article>
            );
          })}
          {busy ? <p className="neuro-chat-empty">Đang chạy Search Core…</p> : null}
        </div>

        <form
          className="neuro-chat-bar"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <textarea
            ref={composerRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder={mode === "chat" ? "Hỏi Neuro hoặc nhập lệnh..." : "Dán SearchPlan JSON..."}
            aria-label={mode === "chat" ? "Hỏi Neuro hoặc nhập lệnh" : "SearchPlan JSON"}
            rows={mode === "script" ? 6 : 3}
            spellCheck={mode === "chat"}
          />
          <div className="neuro-chat-tools">
            <button type="button" className="neuro-chat-tool" disabled title="Chưa hỗ trợ đính kèm" aria-label="Đính kèm">
              <Plus size={16} />
            </button>
            <button
              type="button"
              className={`neuro-chat-tool ${mode === "script" ? "is-on" : ""}`}
              aria-pressed={mode === "script"}
              aria-label="Script"
              title="Script"
              onClick={() => setMode((current) => (current === "chat" ? "script" : "chat"))}
            >
              <Code2 size={16} />
              <span>Script</span>
            </button>
            <button type="submit" className="neuro-chat-send" disabled={busy || !value.trim()} aria-label="Gửi">
              <ArrowUp size={16} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
