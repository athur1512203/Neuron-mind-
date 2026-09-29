import { ArrowLeft, Brain, Link2, Maximize2, Minimize2, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Neuron, NeuronConnection, Position3D, Selection, Subject } from "../types";
import { getConnectionCount } from "../utils/neuron";
import { CreateNeuronModal } from "./CreateNeuronModal";
import { NeuralCanvas } from "./NeuralCanvas";
import { NeuronDetailPanel, type DetailTab } from "./NeuronDetailPanel";

type LearningMapProps = {
  subject: Subject;
  neurons: Neuron[];
  connections: NeuronConnection[];
  mapExpanded: boolean;
  onToggleMapExpanded: () => void;
  selection: Selection;
  notice: string | null;
  onBack: () => void;
  onSelectNeuron: (neuronId: string) => void;
  onSelectConnection: (connectionId: string) => void;
  onLayoutSettled: (positions: Record<string, Position3D>) => void;
  graphLoading?: boolean;
  graphError?: string | null;
  detailInitialTab?: DetailTab;
  onCreateNeuron: (neuron: Neuron) => void | Promise<void>;
  onCreateConnection: (sourceId: string, targetId: string) => void | Promise<void>;
  onUpdateNeuron: (neuron: Neuron) => void;
  onSaveNote: (neuronId: string, note: string) => Promise<void>;
  onDeleteNeuron: (neuronId: string) => Promise<void>;
  onUpdateConnection: (connection: NeuronConnection) => void;
  onDeleteConnection: (connectionId: string) => Promise<void>;
};

const NEURON_SPACING_KEY = "neuromind_neuron_spacing";
const DEFAULT_NEURON_SPACING = 2.4;

function loadNeuronSpacing() {
  const stored = Number(window.localStorage.getItem(NEURON_SPACING_KEY));
  return Number.isFinite(stored) && stored >= 1.5 && stored <= 5 ? stored : DEFAULT_NEURON_SPACING;
}

export function LearningMap({
  subject,
  neurons,
  connections,
  mapExpanded,
  onToggleMapExpanded,
  selection,
  notice,
  onBack,
  onSelectNeuron,
  graphLoading,
  graphError,
  detailInitialTab,
  onSelectConnection,
  onLayoutSettled,
  onCreateNeuron,
  onCreateConnection,
  onUpdateNeuron,
  onSaveNote,
  onDeleteNeuron,
  onUpdateConnection,
  onDeleteConnection,
}: LearningMapProps) {
  const [showCreateNeuron, setShowCreateNeuron] = useState(false);
  const [connectionMode, setConnectionMode] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<NeuronConnection | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [toast, setToast] = useState("");
  const deletingRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [focusNeuronId, setFocusNeuronId] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [neuronSpacing, setNeuronSpacing] = useState(loadNeuronSpacing);

  useEffect(() => {
    window.localStorage.setItem(NEURON_SPACING_KEY, neuronSpacing.toFixed(1));
  }, [neuronSpacing]);

  const filteredNeurons = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    if (!lowered) return [];
    return neurons.filter((neuron) => neuron.name.toLowerCase().includes(lowered));
  }, [neurons, query]);

  const selectedNeuron = selection?.type === "neuron" ? neurons.find((neuron) => neuron.id === selection.id) : null;
  const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId) ?? null;

  useEffect(() => {
    setSelectedConnectionId(null);
    setPendingDelete(null);
    setToast("");
  }, [subject.id]);

  useEffect(() => {
    if (!selectedConnection) setSelectedConnectionId(null);
  }, [selectedConnection]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (pendingDelete) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [pendingDelete]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.defaultPrevented || event.repeat || event.isComposing || connectionMode || pendingDelete || !selectedConnection) return;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [contenteditable], [role='textbox'], dialog"))) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      event.preventDefault();
      setDeleteError("");
      setPendingDelete(selectedConnection);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedConnection, connectionMode, pendingDelete]);

  const confirmDeleteConnection = async () => {
    if (!pendingDelete || deletingRef.current) return;
    deletingRef.current = true;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await onDeleteConnection(pendingDelete.id);
      setSelectedConnectionId((current) => current === pendingDelete.id ? null : current);
      setPendingDelete(null);
      setToast("Đã xóa liên kết");
    } catch {
      setDeleteError("Không thể xóa liên kết. Vui lòng thử lại.");
    } finally {
      deletingRef.current = false;
      setDeleteBusy(false);
    }
  };
  const focusNeuron = (neuronId: string) => {
    setFocusNeuronId(neuronId);
    onSelectNeuron(neuronId);
    setQuery("");
  };

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <button onClick={onBack} className="mb-1 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-950">
                <ArrowLeft size={16} />
                {subject.name}
              </button>
              <p className="app-metadata text-slate-500">
                {subject.neuronCount} neuron • {subject.connectionCount} kết nối
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-10 w-64 rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm"
                  placeholder="Tìm neuron..."
                />
                {filteredNeurons.length > 0 && (
                  <div className="absolute right-0 top-12 z-20 w-72 rounded-md border border-slate-200 bg-white py-2 shadow-xl">
                    {filteredNeurons.map((neuron) => (
                      <button
                        key={neuron.id}
                        onClick={() => focusNeuron(neuron.id)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <span>{neuron.name}</span>
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: neuron.color }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <label className="flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-600">
                <span className="whitespace-nowrap font-semibold">Khoảng cách neuron</span>
                <input
                  type="range"
                  min="1.5"
                  max="5"
                  step="0.1"
                  value={neuronSpacing}
                  onChange={(event) => setNeuronSpacing(Number(event.target.value))}
                  className="w-24 accent-blue-600"
                />
                <output className="w-7 text-right font-semibold text-slate-800">{neuronSpacing.toFixed(1)}</output>
              </label>
              <button
                onClick={() => setShowCreateNeuron(true)}
                className="action-3d-button"
              >
                <span className="btn-shadow" />
                <span className="btn-edge" />
                <span className="btn-front"><Plus />Tạo neuron</span>
              </button>
              <button
                type="button"
                onClick={() => setConnectionMode((value) => !value)}
                className={`action-3d-button ${connectionMode ? "" : "secondary"}`}
              >
                <span className="btn-shadow" />
                <span className="btn-edge" />
                <span className="btn-front">
                  <Link2 />
                  {connectionMode ? "Đang tạo liên kết" : "Tạo liên kết"}
                </span>
              </button>
              <button
                onClick={() => setResetSignal((value) => value + 1)}
                className="action-3d-button secondary"
              >
                <span className="btn-shadow" />
                <span className="btn-edge" />
                <span className="btn-front"><RotateCcw />Reset View</span>
              </button>
            </div>
          </div>
          {notice && <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{notice}</div>}
        </header>

        <div className={`learning-map-layout min-h-0 flex-1 overflow-y-auto xl:overflow-hidden ${selectedNeuron ? "has-neuron-detail" : ""}`}>
          <div className="relative min-h-[520px] min-w-0 p-4 xl:min-h-0">
            <button
              type="button"
              onClick={onToggleMapExpanded}
              title={mapExpanded ? "Thu nhỏ sơ đồ" : "Mở rộng sơ đồ"}
              aria-label={mapExpanded ? "Thu nhỏ sơ đồ" : "Mở rộng sơ đồ"}
              className="absolute right-6 top-6 z-10 rounded-md border border-slate-700/70 bg-slate-900/80 p-2 text-white shadow-lg backdrop-blur-sm hover:bg-slate-800"
            >
              {mapExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <div className="relative h-full min-h-0">
            {selectedConnection && !connectionMode ? (
              <button type="button" className="brutal-button brutal-button-danger absolute left-2 top-2 z-10" onClick={() => { setDeleteError(""); setPendingDelete(selectedConnection); }}>
                <Trash2 size={16} />Xóa liên kết
              </button>
            ) : null}
            {toast ? <div role="status" className="pointer-events-none absolute bottom-4 left-4 z-20 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 shadow">{toast}</div> : null}
            <NeuralCanvas
              neurons={neurons}
              connections={connections}
              selectedNeuronId={selectedNeuron?.id ?? null}
              selectedConnectionId={selectedConnection?.id ?? null}
              focusNeuronId={focusNeuronId}
              resetSignal={resetSignal}
              connectionMode={connectionMode}
              onSelectNeuron={onSelectNeuron}
              onSelectConnection={(id) => setSelectedConnectionId(id || null)}
              onLayoutSettled={onLayoutSettled}
              onCreateConnection={onCreateConnection}
              neuronSpacing={neuronSpacing}
            />
            {graphLoading ? (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center text-sm text-slate-300">
                Đang tải sơ đồ...
              </div>
            ) : null}
            {graphError ? (
              <div className="absolute inset-x-6 top-16 z-20 rounded-md border border-red-500/40 bg-slate-950/80 px-3 py-2 text-sm text-red-300">
                {graphError}
              </div>
            ) : null}
            {!graphLoading && neurons.length === 0 && (
              <div className="nm-graph-empty-overlay">
                <div className="nm-graph-empty-card">
                  <span className="nm-graph-empty-icon" aria-hidden="true"><Brain size={28} /></span>
                  <h3>Không gian này chưa có neuron</h3>
                  <p>
                    Tạo neuron đầu tiên để bắt đầu xây dựng mạng lưới kiến thức của bạn.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateNeuron(true)}
                    className="nm-create-button nm-graph-empty-button"
                  >
                    <Plus size={18} aria-hidden="true" />
                    Tạo neuron đầu tiên
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>

          {selectedNeuron ? (
            <div className="learning-map-detail-pane min-h-[420px] overflow-hidden border-t border-[#1b2a3d] bg-[#071322] xl:min-h-0 xl:border-l xl:border-t-0">
              <NeuronDetailPanel
                neuron={selectedNeuron}
                neurons={neurons}
                connections={connections}
                connectionCount={getConnectionCount(selectedNeuron.id, connections)}
                onClose={() => onSelectNeuron("")}
                onDelete={onDeleteNeuron}
                onUpdate={onUpdateNeuron}
                onSaveNote={onSaveNote}
                onSelectNeuron={focusNeuron}
                initialTab={detailInitialTab}
              />
            </div>
          ) : null}
        </div>
      </section>

      <dialog ref={dialogRef} aria-labelledby="delete-connection-title" className="brutal-dialog m-auto backdrop:bg-black/60" onCancel={(event) => { event.preventDefault(); if (!deleteBusy) setPendingDelete(null); }}>
        <h2 id="delete-connection-title" className="text-xl font-bold">Xóa liên kết?</h2>
        <p className="mt-3 break-words">Bạn có chắc muốn xóa liên kết giữa {neurons.find((neuron) => neuron.id === pendingDelete?.sourceNeuronId)?.name} và {neurons.find((neuron) => neuron.id === pendingDelete?.targetNeuronId)?.name}?</p>
        {deleteError ? <p role="alert" className="mt-3 text-sm text-red-700">{deleteError}</p> : null}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" autoFocus disabled={deleteBusy} className="brutal-button" onClick={() => setPendingDelete(null)}>Hủy</button>
          <button type="button" disabled={deleteBusy} className="brutal-button brutal-button-danger" onClick={() => void confirmDeleteConnection()}><Trash2 size={16} />{deleteBusy ? "Đang xóa..." : "Xóa liên kết"}</button>
        </div>
      </dialog>
      {showCreateNeuron && (
        <CreateNeuronModal
          subjectId={subject.id}
          neuronCount={neurons.length}
          onClose={() => setShowCreateNeuron(false)}
          onCreate={async (neuron) => {
            await onCreateNeuron(neuron);
            setShowCreateNeuron(false);
          }}
        />
      )}
    </main>
  );
}
