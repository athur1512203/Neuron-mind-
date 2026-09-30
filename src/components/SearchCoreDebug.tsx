import { useState } from "react";
import { ApiError } from "../api/client";
import {
  debugSearchCore,
  type RetrievedInformation,
  type SearchDebugRequest,
  type SearchSourceType,
} from "../api/search";

const SOURCE_OPTIONS: Array<SearchSourceType | ""> = ["", "NEURON", "MARKDOWN", "DOCUMENT"];

type RequestRow = { key: string; id: string; query: string; source: SearchSourceType | "" };

let rowKey = 1;

function fieldClass() {
  return "mt-1 w-full border-2 border-black bg-white px-3 py-2 text-sm";
}

export function SearchCoreDebug() {
  const [spaceQuery, setSpaceQuery] = useState("Tài liệu học TMU");
  const [spaceId, setSpaceId] = useState("");
  const [neuronQuery, setNeuronQuery] = useState("Nghiên cứu khoa học");
  const [neuronId, setNeuronId] = useState("");
  const [rows, setRows] = useState<RequestRow[]>([
    { key: "r0", id: "main", query: "nghiên cứu khoa học", source: "" },
  ]);
  const [sent, setSent] = useState<SearchDebugRequest | null>(null);
  const [result, setResult] = useState<RetrievedInformation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);

  const buildBody = (): SearchDebugRequest => {
    const space: SearchDebugRequest["space"] = {};
    if (spaceQuery.trim()) space.query = spaceQuery.trim();
    if (spaceId.trim()) space.id = spaceId.trim();
    const neuron: SearchDebugRequest["neuron"] = {};
    if (neuronQuery.trim()) neuron.query = neuronQuery.trim();
    if (neuronId.trim()) neuron.id = neuronId.trim();
    return {
      ...(Object.keys(space).length ? { space } : {}),
      ...(Object.keys(neuron).length ? { neuron } : {}),
      requests: rows.map((row) => ({
        id: row.id.trim(),
        query: row.query,
        ...(row.source ? { sources: [row.source] } : {}),
      })),
    };
  };

  const run = async () => {
    const body = buildBody();
    setSent(body);
    setBusy(true);
    setError(null);
    try {
      setResult(await debugSearchCore(body));
    } catch (caught) {
      setResult(null);
      if (caught instanceof ApiError) {
        setError(`${caught.status} ${caught.code}: ${caught.message}`);
      } else {
        setError("500 UNKNOWN: Request failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const namesBySpace = new Map<string, string>();
  const namesByNeuron = new Map<string, string>();
  for (const source of result?.sources ?? []) {
    if (source.subjectName) namesBySpace.set(source.subjectId, source.subjectName);
    if (source.title) namesByNeuron.set(source.neuronId, source.title);
  }
  for (const request of result?.requests ?? []) {
    for (const item of request.results) {
      if (item.subjectName) namesBySpace.set(item.subjectId, item.subjectName);
      if (item.title) namesByNeuron.set(item.neuronId, item.title);
    }
  }

  return (
    <main className="min-h-screen flex-1 overflow-auto bg-slate-50 p-6 text-slate-900">
      <h1 className="text-xl font-black">Search Core Debug (temporary)</h1>
      <p className="mt-1 text-sm text-slate-600">Uses the logged-in account. userId is not sent from this page.</p>

      <section className="mt-6 max-w-3xl border-2 border-black bg-white p-4">
        <h2 className="font-bold">Space</h2>
        <label className="mt-2 block text-sm font-semibold">Space query
          <input className={fieldClass()} value={spaceQuery} onChange={(event) => setSpaceQuery(event.target.value)} />
        </label>
        <label className="mt-2 block text-sm font-semibold">Space ID (optional)
          <input className={fieldClass()} value={spaceId} onChange={(event) => setSpaceId(event.target.value)} />
        </label>

        <h2 className="mt-4 font-bold">Neuron</h2>
        <label className="mt-2 block text-sm font-semibold">Neuron query
          <input className={fieldClass()} value={neuronQuery} onChange={(event) => setNeuronQuery(event.target.value)} />
        </label>
        <label className="mt-2 block text-sm font-semibold">Neuron ID (optional)
          <input className={fieldClass()} value={neuronId} onChange={(event) => setNeuronId(event.target.value)} />
        </label>

        <h2 className="mt-4 font-bold">Requests</h2>
        {rows.map((row, index) => (
          <div key={row.key} className="mt-3 border-2 border-black p-3">
            <label className="block text-sm font-semibold">request ID
              <input className={fieldClass()} value={row.id} onChange={(event) => {
                const next = [...rows];
                next[index] = { ...row, id: event.target.value };
                setRows(next);
              }} />
            </label>
            <label className="mt-2 block text-sm font-semibold">query
              <input className={fieldClass()} value={row.query} onChange={(event) => {
                const next = [...rows];
                next[index] = { ...row, query: event.target.value };
                setRows(next);
              }} />
            </label>
            <label className="mt-2 block text-sm font-semibold">source filter (optional)
              <select className={fieldClass()} value={row.source} onChange={(event) => {
                const next = [...rows];
                next[index] = { ...row, source: event.target.value as SearchSourceType | "" };
                setRows(next);
              }}>
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option || "all"} value={option}>{option || "all"}</option>
                ))}
              </select>
            </label>
            <button type="button" className="mt-2 border-2 border-black px-3 py-1 text-sm" onClick={() => setRows(rows.filter((_, i) => i !== index))} disabled={rows.length === 1}>
              Remove request
            </button>
          </div>
        ))}
        <button type="button" className="mt-3 border-2 border-black bg-yellow-200 px-3 py-2 text-sm font-bold" onClick={() => setRows([...rows, { key: `r${rowKey++}`, id: `req-${rows.length + 1}`, query: "", source: "" }])}>
          Add request
        </button>
        <button type="button" className="ml-2 mt-3 border-2 border-black bg-emerald-200 px-3 py-2 text-sm font-bold" onClick={() => void run()} disabled={busy}>
          {busy ? "Running…" : "Run Search Core"}
        </button>
      </section>

      {error && (
        <section className="mt-6 max-w-3xl border-2 border-red-600 bg-red-50 p-4">
          <h2 className="font-bold">Error</h2>
          <p className="mt-1 font-mono text-sm">{error}</p>
        </section>
      )}

      {sent && (
        <section className="mt-6 max-w-4xl border-2 border-black bg-white p-4">
          <h2 className="font-bold">A. Search Plan</h2>
          <pre className="mt-2 overflow-auto text-xs">{JSON.stringify(sent, null, 2)}</pre>
        </section>
      )}

      {result && (
        <>
          <section className="mt-6 max-w-4xl border-2 border-black bg-white p-4">
            <h2 className="font-bold">B. Resolved scope</h2>
            <ul className="mt-2 text-sm">
              {result.plan.resolvedSpaceIds.map((id) => (
                <li key={id}>Space {id}{namesBySpace.get(id) ? ` — ${namesBySpace.get(id)}` : ""}</li>
              ))}
              {result.plan.resolvedNeuronIds.map((id) => (
                <li key={id}>Neuron {id}{namesByNeuron.get(id) ? ` — ${namesByNeuron.get(id)}` : ""}</li>
              ))}
            </ul>
            {!result.plan.resolvedSpaceIds.length && !result.plan.resolvedNeuronIds.length && (
              <p className="mt-2 text-sm">No resolved Space/Neuron IDs.</p>
            )}
          </section>

          <section className="mt-6 max-w-4xl">
            <h2 className="font-bold">C. Request results</h2>
            {result.requests.map((request) => (
              <div key={request.requestId} className="mt-3 border-2 border-black bg-white p-4">
                <p className="font-mono text-sm">requestId: {request.requestId}</p>
                <p className="text-sm">query: {request.query}</p>
                <p className="mt-1 font-black">{request.found ? "FOUND" : "NOT FOUND"}</p>
                <p className="text-sm">result count: {request.results.length}</p>
                {request.results.map((item) => (
                  <div key={item.id} className="mt-3 border-2 border-slate-400 p-3 text-sm">
                    <p>sourceType: {item.sourceType}</p>
                    <p>title: {item.title}</p>
                    <p>heading: {item.heading}</p>
                    <p className="whitespace-pre-wrap">content: {item.content}</p>
                    {item.snippet ? <p>snippet: {item.snippet}</p> : null}
                    <p>score: {item.score}</p>
                    <p>subjectId: {item.subjectId}</p>
                    <p>neuronId: {item.neuronId}</p>
                    <pre className="mt-1 overflow-auto text-xs">{JSON.stringify({ provenance: item.provenance, metadata: item.metadata }, null, 2)}</pre>
                  </div>
                ))}
              </div>
            ))}
          </section>

          <section className="mt-6 max-w-4xl border-2 border-black bg-white p-4">
            <button type="button" className="font-bold" onClick={() => setRawOpen((open) => !open)}>
              {rawOpen ? "Hide" : "Show"} D. Raw RetrievedInformation
            </button>
            {rawOpen && <pre className="mt-2 overflow-auto text-xs">{JSON.stringify(result, null, 2)}</pre>}
          </section>
        </>
      )}
    </main>
  );
}

export function isSearchCoreDebugPath() {
  return window.location.pathname.replace(/\/$/, "") === "/debug/search-core"
    || window.location.hash.replace(/^#/, "") === "/debug/search-core";
}
