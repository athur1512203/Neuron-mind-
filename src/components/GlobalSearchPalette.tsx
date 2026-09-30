import { Code2, FileText, Hash, NotebookText, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ApiError, apiMessage } from "../api/client";
import {
  debugSearchCore,
  searchGlobal,
  type RetrievedDebugItem,
  type RetrievedInformation,
  type SearchDebugRequest,
  type SearchResult,
  type SearchResultType,
} from "../api/search";

type SearchMode = "search" | "searchPlan";

type GlobalSearchPaletteProps = {
  open: boolean;
  onClose: () => void;
  onOpenResult: (result: SearchResult) => void;
};

const GROUP_LABEL: Record<SearchResultType, string> = {
  neuron: "NEURON",
  markdown: "MARKDOWN",
  document: "TÀI LIỆU",
};

const GROUP_ICON: Record<SearchResultType, typeof Hash> = {
  neuron: Hash,
  markdown: NotebookText,
  document: FileText,
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
  const space = item.subjectName ? item.subjectName : item.subjectId;
  const neuron = item.title || item.neuronId;
  return (
    <article className="global-search-plan-hit">
      <p className="global-search-plan-meta">
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
      <p className="global-search-plan-body">{item.content || item.snippet || ""}</p>
      <p className="global-search-plan-score">Score: {formatScore(item.score)}</p>
    </article>
  );
}

function SearchPlanResults({ result }: { result: RetrievedInformation }) {
  const [rawOpen, setRawOpen] = useState(false);
  return (
    <div className="global-search-plan-out">
      <p className="global-search-plan-kicker">Search Core</p>
      {result.requests.map((request) => (
        <section key={request.requestId} className="global-search-plan-request">
          <p className="global-search-plan-head">
            {request.requestId}
            <span>{request.found ? "FOUND" : "NOT FOUND"}</span>
          </p>
          <p className="global-search-plan-query">{request.query}</p>
          {request.results.map((item) => (
            <SearchHit key={item.id} item={item} />
          ))}
        </section>
      ))}
      <button type="button" className="global-search-raw-toggle" onClick={() => setRawOpen((open) => !open)}>
        {rawOpen ? "Hide raw JSON" : "Raw JSON"}
      </button>
      {rawOpen ? <pre className="global-search-raw">{JSON.stringify(result, null, 2)}</pre> : null}
    </div>
  );
}

export function GlobalSearchPalette({ open, onClose, onOpenResult }: GlobalSearchPaletteProps) {
  const [mode, setMode] = useState<SearchMode>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [plan, setPlan] = useState("");
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planResult, setPlanResult] = useState<RetrievedInformation | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const planRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setMode("search");
    setQuery("");
    setResults([]);
    setError(null);
    setActiveIndex(0);
    setPlanError(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (mode === "searchPlan") window.setTimeout(() => planRef.current?.focus(), 0);
    else window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || mode !== "search") return;
    const needle = query.trim();
    if (!needle) {
      setResults([]);
      setLoading(false);
      setError(null);
      setActiveIndex(0);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void searchGlobal(needle, { signal: controller.signal, limit: 20 })
        .then((response) => {
          setResults(response.results);
          setActiveIndex(0);
        })
        .catch((caught: unknown) => {
          if (controller.signal.aborted) return;
          setResults([]);
          setError(apiMessage(caught, "Không tìm kiếm được dữ liệu."));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, mode, query]);

  const grouped = useMemo(
    () => ({
      neuron: results.filter((result) => result.type === "neuron"),
      markdown: results.filter((result) => result.type === "markdown"),
      document: results.filter((result) => result.type === "document"),
    }),
    [results],
  );

  if (!open) return null;

  const choose = (result: SearchResult) => {
    onOpenResult(result);
    onClose();
  };

  const runPlan = async () => {
    const text = plan.trim();
    if (!text || planBusy) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (caught) {
      setPlanResult(null);
      setPlanError(`INVALID JSON${caught instanceof SyntaxError ? `: ${caught.message}` : ""}`);
      return;
    }
    setPlanBusy(true);
    setPlanError(null);
    try {
      const result = await debugSearchCore(stripClientUserId(parsed) as SearchDebugRequest);
      setPlanResult(result);
    } catch (caught) {
      setPlanResult(null);
      if (caught instanceof ApiError && caught.status === 404) {
        setPlanError("Search Core debug endpoint is disabled.");
      } else if (caught instanceof ApiError && caught.status === 401) {
        setPlanError("Authentication required");
      } else if (caught instanceof ApiError && caught.status === 400) {
        setPlanError("SearchPlan validation failed");
      } else {
        setPlanError(apiMessage(caught, "Request failed"));
      }
    } finally {
      setPlanBusy(false);
    }
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!results.length) return;
      setActiveIndex((index) => Math.min(results.length - 1, index + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!results.length) return;
      setActiveIndex((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    }
  };

  const onPlanKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void runPlan();
    }
  };

  return (
    <div className="global-search-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="global-search-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Global Search"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="global-search-top">
          <h2>Global Search</h2>
          <button type="button" className="brutal-icon-button" onClick={onClose} aria-label="Đóng tìm kiếm">
            <X size={18} />
          </button>
        </header>

        <div className="global-search-modes" role="tablist" aria-label="Chế độ tìm kiếm">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "search"}
            className={`global-search-mode ${mode === "search" ? "is-on" : ""}`}
            onClick={() => setMode("search")}
          >
            <Search size={14} aria-hidden="true" />
            Search
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "searchPlan"}
            className={`global-search-mode ${mode === "searchPlan" ? "is-on" : ""}`}
            onClick={() => setMode("searchPlan")}
          >
            <Code2 size={14} aria-hidden="true" />
            SearchPlan
          </button>
        </div>

        {mode === "search" ? (
          <>
            <div className="global-search-input">
              <Search size={18} aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Tìm kiếm trong NeuroMind..."
                aria-label="Tìm kiếm trong NeuroMind"
              />
            </div>
            <div className="global-search-body">
              {!query.trim() ? (
                <p className="global-search-state">Nhập từ khóa để tìm neuron, Markdown Note hoặc tài liệu.</p>
              ) : null}
              {loading ? <p className="global-search-state">Đang tìm...</p> : null}
              {error ? <p className="global-search-state is-error">{error}</p> : null}
              {!loading && !error && query.trim() && results.length === 0 ? (
                <p className="global-search-state">Không tìm thấy kết quả phù hợp.</p>
              ) : null}

              {(["neuron", "markdown", "document"] as SearchResultType[]).map((type) => {
                const items = grouped[type];
                if (!items.length) return null;
                const Icon = GROUP_ICON[type];
                return (
                  <div key={type} className="global-search-group">
                    <h3>{GROUP_LABEL[type]}</h3>
                    <div className="global-search-list">
                      {items.map((result) => {
                        const absoluteIndex = results.indexOf(result);
                        const active = absoluteIndex === activeIndex;
                        return (
                          <button
                            key={`${result.type}-${result.id}`}
                            type="button"
                            className={`global-search-result ${active ? "is-active" : ""}`}
                            onMouseEnter={() => setActiveIndex(absoluteIndex)}
                            onClick={() => choose(result)}
                          >
                            <Icon size={17} aria-hidden="true" />
                            <span>
                              <strong>{result.title}</strong>
                              <small>
                                {result.subjectName}
                                {result.snippet ? ` · ${result.snippet}` : ""}
                              </small>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="global-search-plan-editor">
              <textarea
                ref={planRef}
                value={plan}
                onChange={(event) => setPlan(event.target.value)}
                onKeyDown={onPlanKeyDown}
                spellCheck={false}
                placeholder='{"requests":[{"id":"nova","query":"ai phụ trách backend dự án Nova","sources":["MARKDOWN"]}]}'
                aria-label="SearchPlan JSON"
              />
              <button type="button" className="global-search-run" disabled={planBusy || !plan.trim()} onClick={() => void runPlan()}>
                Run SearchPlan
              </button>
            </div>
            <div className="global-search-body">
              {planBusy ? <p className="global-search-state">Đang chạy Search Core…</p> : null}
              {planError ? <p className="global-search-state is-error">{planError}</p> : null}
              {!planBusy && !planError && !planResult ? (
                <p className="global-search-state">Dán SearchPlan JSON rồi Run (Ctrl/Cmd+Enter). Không tạo câu trả lời AI.</p>
              ) : null}
              {planResult ? <SearchPlanResults result={planResult} /> : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
