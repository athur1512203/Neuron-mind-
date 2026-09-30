import { useCallback, useState, type KeyboardEvent } from "react";
import { ApiError } from "../api/client";
import { debugSearchCore, type SearchDebugRequest } from "../api/search";

export const SEARCH_CORE_EXAMPLE = `{
  "space": {
    "query": "công việc"
  },
  "neuron": {
    "query": "Kinh doanh"
  },
  "requests": [
    {
      "id": "main",
      "query": "ai phụ trách backend",
      "sources": ["MARKDOWN"]
    }
  ]
}`;

type ConsoleOutput = {
  status: string;
  timeMs: number | null;
  body: string;
};

function stripClientUserId(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { userId: _ignored, ...rest } = value as Record<string, unknown>;
  return rest;
}

function describeError(error: unknown): { status: string; body: string } {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return { status: "404", body: "Search Core debug endpoint is disabled." };
    }
    if (error.status === 401) {
      return { status: "401", body: "Authentication required" };
    }
    if (error.status === 400) {
      return { status: "400", body: "SearchPlan validation failed" };
    }
    if (error.status === 403) {
      return { status: "403", body: error.message };
    }
    if (error.status === 500) {
      return { status: "500", body: error.message };
    }
    return { status: String(error.status), body: error.message };
  }
  return { status: "500", body: "Request failed" };
}

export function SearchCoreDebug() {
  const [script, setScript] = useState(SEARCH_CORE_EXAMPLE);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<ConsoleOutput | null>(null);

  const run = useCallback(async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script);
    } catch (error) {
      const detail = error instanceof SyntaxError ? error.message : "Invalid JSON";
      setOutput({ status: "INVALID JSON", timeMs: null, body: detail });
      return;
    }
    const body = stripClientUserId(parsed) as SearchDebugRequest;
    const started = performance.now();
    setBusy(true);
    try {
      const result = await debugSearchCore(body);
      setOutput({
        status: "200",
        timeMs: Math.round(performance.now() - started),
        body: JSON.stringify(result, null, 2),
      });
    } catch (error) {
      const described = describeError(error);
      setOutput({
        status: described.status,
        timeMs: Math.round(performance.now() - started),
        body: described.body,
      });
    } finally {
      setBusy(false);
    }
  }, [script]);

  const formatJson = () => {
    try {
      setScript(JSON.stringify(JSON.parse(script), null, 2));
    } catch (error) {
      const detail = error instanceof SyntaxError ? error.message : "Invalid JSON";
      setOutput({ status: "INVALID JSON", timeMs: null, body: detail });
    }
  };

  const onEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      if (!busy) void run();
    }
  };

  const copyOutput = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output.body);
    } catch {
      /* Clipboard can be denied. */
    }
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50">
      <header className="flex shrink-0 items-center justify-between border-b-2 border-black bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-black">Search Core Test</h1>
          <p className="text-sm text-slate-600">Test SearchPlan directly against Search Core</p>
        </div>
        <button
          type="button"
          className="border-2 border-black bg-emerald-200 px-3 py-2 text-sm font-bold disabled:opacity-60"
          onClick={() => void run()}
          disabled={busy}
        >
          {busy ? "Running…" : "Run Search Core"}
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-2 gap-0 lg:grid-cols-2 lg:grid-rows-1">
        <section className="flex min-h-0 flex-col border-b-2 border-black bg-white lg:border-b-0 lg:border-r-2">
          <div className="flex items-center justify-between border-b-2 border-black px-4 py-2">
            <h2 className="text-xs font-black tracking-wide">SEARCH PLAN</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="border-2 border-black px-2 py-1 text-xs font-bold" onClick={formatJson}>
                Format JSON
              </button>
              <button type="button" className="border-2 border-black px-2 py-1 text-xs font-bold" onClick={() => setScript(SEARCH_CORE_EXAMPLE)}>
                Reset Example
              </button>
              <button type="button" className="border-2 border-black px-2 py-1 text-xs font-bold" onClick={() => setOutput(null)}>
                Clear Output
              </button>
              <button type="button" className="border-2 border-black px-2 py-1 text-xs font-bold" onClick={() => void copyOutput()} disabled={!output}>
                Copy Output
              </button>
            </div>
          </div>
          <textarea
            className="min-h-0 flex-1 resize-none bg-white p-4 font-mono text-sm leading-6 outline-none"
            spellCheck={false}
            value={script}
            onChange={(event) => setScript(event.target.value)}
            onKeyDown={onEditorKeyDown}
            aria-label="SearchPlan JSON"
          />
        </section>

        <section className="flex min-h-0 flex-col bg-slate-50">
          <div className="border-b-2 border-black bg-white px-4 py-2">
            <h2 className="text-xs font-black tracking-wide">OUTPUT</h2>
            {output ? (
              <p className="mt-1 font-mono text-xs">
                STATUS: {output.status}
                {output.timeMs != null ? `    TIME: ${output.timeMs} ms` : ""}
              </p>
            ) : (
              <p className="mt-1 font-mono text-xs text-slate-500">No output yet.</p>
            )}
          </div>
          <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-5">
            {output?.body ?? ""}
          </pre>
        </section>
      </div>
    </main>
  );
}

export function isSearchCoreDebugPath() {
  return window.location.pathname.replace(/\/$/, "") === "/debug/search-core"
    || window.location.hash.replace(/^#/, "") === "/debug/search-core";
}
