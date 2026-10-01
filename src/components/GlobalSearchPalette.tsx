import { AlertCircle, Code2, LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ApiError, apiMessage } from "../api/client";
import {
  debugSearchCore,
  getApiHealth,
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

const BADGE: Record<SearchResultType, string> = {
  neuron: "NEURON",
  markdown: "MARKDOWN",
  document: "DOCUMENT",
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
    <article className="gs-hit">
      <dl className="gs-hit-meta">
        <div><dt>Space</dt><dd>{space}</dd></div>
        <div><dt>Neuron</dt><dd>{neuron}</dd></div>
        <div><dt>Source</dt><dd>{item.sourceType}</dd></div>
        {item.heading ? (
          <div><dt>Heading</dt><dd>{item.heading}</dd></div>
        ) : null}
      </dl>
      <p className="gs-hit-body">{item.content || item.snippet || ""}</p>
      <p className="gs-hit-score">Score {formatScore(item.score)}</p>
    </article>
  );
}

function SearchPlanResults({ result }: { result: RetrievedInformation }) {
  const [rawOpen, setRawOpen] = useState(false);
  return (
    <div className="gs-plan-out">
      {result.requests.map((request) => (
        <section key={request.requestId} className="gs-plan-request">
          <div className="gs-plan-request-head">
            <span className="gs-plan-id">{request.requestId}</span>
            <span className={`gs-found ${request.found ? "is-yes" : "is-no"}`}>
              {request.found ? "FOUND" : "NOT FOUND"}
            </span>
          </div>
          <p className="gs-plan-query">{request.query}</p>
          {request.results.map((item) => (
            <SearchHit key={item.id} item={item} />
          ))}
        </section>
      ))}
      <button type="button" className="gs-raw-toggle" onClick={() => setRawOpen((open) => !open)}>
        {rawOpen ? "Hide Raw JSON" : "View Raw JSON"}
      </button>
      {rawOpen ? <pre className="gs-raw">{JSON.stringify(result, null, 2)}</pre> : null}
    </div>
  );
}

export function GlobalSearchPalette({ open, onClose, onOpenResult }: GlobalSearchPaletteProps) {
  const [mode, setMode] = useState<SearchMode>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [plan, setPlan] = useState("");
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planResult, setPlanResult] = useState<RetrievedInformation | null>(null);
  const [searchDebug, setSearchDebug] = useState(false);
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
    const controller = new AbortController();
    void getApiHealth(controller.signal)
      .then((health) => setSearchDebug(health.searchDebug === true))
      .catch(() => setSearchDebug(false));
    window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => controller.abort();
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
    if (!searchDebug && mode === "searchPlan") setMode("search");
  }, [searchDebug, mode]);

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
  }, [open, mode, query, retryTick]);

  if (!open) return null;

  const choose = (result: SearchResult) => {
    onOpenResult(result);
    onClose();
  };

  const formatPlan = () => {
    try {
      setPlan(JSON.stringify(JSON.parse(plan), null, 2));
      setPlanError(null);
    } catch (caught) {
      setPlanError(`JSON không hợp lệ${caught instanceof SyntaxError ? `: ${caught.message}` : ""}`);
    }
  };

  const resetPlan = () => {
    setPlan("");
    setPlanError(null);
    setPlanResult(null);
  };

  const runPlan = async () => {
    const text = plan.trim();
    if (!text || planBusy) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (caught) {
      setPlanResult(null);
      setPlanError(`JSON không hợp lệ${caught instanceof SyntaxError ? `: ${caught.message}` : ""}`);
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
    <div className="gs-overlay" role="presentation" onMouseDown={onClose}>
      <section className="gs-modal" role="dialog" aria-modal="true" aria-label="Global Search" onMouseDown={(event) => event.stopPropagation()}>
        <header className="gs-header">
          <div>
            <h2>Global Search</h2>
            <p>Tìm kiếm trong toàn bộ NeuroMind</p>
          </div>
          <button type="button" className="gs-close" onClick={onClose} aria-label="Đóng tìm kiếm">
            <X size={18} />
          </button>
        </header>

        {searchDebug ? (
        <div className="gs-switch" role="tablist" aria-label="Chế độ tìm kiếm">
          <button type="button" role="tab" aria-selected={mode === "search"} className={mode === "search" ? "is-on" : ""} onClick={() => setMode("search")}>
            <Search size={14} aria-hidden="true" />
            Search
          </button>
          <button type="button" role="tab" aria-selected={mode === "searchPlan"} className={mode === "searchPlan" ? "is-on" : ""} onClick={() => setMode("searchPlan")}>
            <Code2 size={14} aria-hidden="true" />
            SearchPlan
          </button>
        </div>
        ) : null}

        {mode !== "searchPlan" || !searchDebug ? (
          <>
            <label className="gs-field">
              <Search size={18} aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Tìm neuron, ghi chú, tài liệu..."
                aria-label="Tìm neuron, ghi chú, tài liệu"
              />
            </label>
            <div className="gs-body">
              {!query.trim() ? (
                <p className="gs-hint">Tìm kiếm neuron, ghi chú và tài liệu trong các không gian của bạn.</p>
              ) : null}
              {loading ? (
                <p className="gs-hint gs-loading">
                  <LoaderCircle size={16} className="gs-spin" aria-hidden="true" />
                  Đang tìm kiếm...
                </p>
              ) : null}
              {error ? (
                <div className="gs-error">
                  <AlertCircle size={16} aria-hidden="true" />
                  <div>
                    <p>Không thể tìm kiếm lúc này.</p>
                    <button type="button" onClick={() => setRetryTick((tick) => tick + 1)}>Thử lại</button>
                  </div>
                </div>
              ) : null}
              {!loading && !error && query.trim() && results.length === 0 ? (
                <p className="gs-hint">Không tìm thấy kết quả phù hợp.</p>
              ) : null}
              {!loading && !error
                ? results.map((result, index) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      type="button"
                      className={`gs-row ${index === activeIndex ? "is-active" : ""}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(result)}
                    >
                      <span className="gs-badge">{BADGE[result.type]}</span>
                      <strong>{result.title}</strong>
                      {result.subjectName ? <span className="gs-space">{result.subjectName}</span> : null}
                      {result.snippet ? <em>{result.snippet}</em> : null}
                    </button>
                  ))
                : null}
            </div>
            <footer className="gs-foot">
              <span>↑↓ Di chuyển</span>
              <span>Enter Mở</span>
              <span>Esc Đóng</span>
              <span>Ctrl K Tìm kiếm</span>
            </footer>
          </>
        ) : (
          <>
            <div className="gs-plan-intro">
              <h3>SearchPlan</h3>
              <p>Chạy trực tiếp Search Core bằng JSON.</p>
            </div>
            <textarea
              ref={planRef}
              className="gs-json"
              value={plan}
              onChange={(event) => setPlan(event.target.value)}
              onKeyDown={onPlanKeyDown}
              spellCheck={false}
              placeholder='{"requests":[{"id":"nova","query":"ai phụ trách backend dự án Nova","sources":["MARKDOWN"]}]}'
              aria-label="SearchPlan JSON"
            />
            {planError ? <p className="gs-plan-error">{planError}</p> : null}
            <div className="gs-plan-actions">
              <button type="button" className="gs-btn" onClick={formatPlan}>Format JSON</button>
              <button type="button" className="gs-btn" onClick={resetPlan}>Reset</button>
              <button type="button" className="gs-btn gs-btn-run" disabled={planBusy || !plan.trim()} onClick={() => void runPlan()}>
                Run SearchPlan
              </button>
            </div>
            <div className="gs-body">
              {planBusy ? (
                <p className="gs-hint gs-loading">
                  <LoaderCircle size={16} className="gs-spin" aria-hidden="true" />
                  Đang chạy Search Core…
                </p>
              ) : null}
              {planResult ? <SearchPlanResults result={planResult} /> : null}
            </div>
            <footer className="gs-foot">
              <span>Ctrl Enter Chạy</span>
              <span>Esc Đóng</span>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
