import { FileText, Hash, NotebookText, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiMessage } from "../api/client";
import { searchGlobal, type SearchResult, type SearchResultType } from "../api/search";

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

export function GlobalSearchPalette({ open, onClose, onOpenResult }: GlobalSearchPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setError(null);
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
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
  }, [open, query]);

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

  return (
    <div className="global-search-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="global-search-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Tìm kiếm trong NeuroMind"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="global-search-input">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
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
            }}
            placeholder="Tìm kiếm trong NeuroMind..."
            aria-label="Tìm kiếm trong NeuroMind"
          />
          <button type="button" onClick={onClose} aria-label="Đóng tìm kiếm">
            <X size={18} />
          </button>
        </div>

        <div className="global-search-body">
          {!query.trim() ? <p className="global-search-state">Nhập từ khóa để tìm neuron, Markdown Note hoặc tài liệu.</p> : null}
          {loading ? <p className="global-search-state">Đang tìm...</p> : null}
          {error ? <p className="global-search-state is-error">{error}</p> : null}
          {!loading && !error && query.trim() && results.length === 0 ? <p className="global-search-state">Không tìm thấy kết quả phù hợp.</p> : null}

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
                          <small>{result.subjectName}{result.snippet ? ` · ${result.snippet}` : ""}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
