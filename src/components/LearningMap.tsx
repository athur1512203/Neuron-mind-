import { Link2, Maximize2, Menu, Minimize2, Minus, MousePointer2, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Neuron, NeuronConnection, Position3D, Selection, Subject } from "../types";
import { getConnectionCount } from "../utils/neuron";
import { CreateNeuronModal } from "./CreateNeuronModal";
import { NeuralCanvas, type NeuralCanvasHandle } from "./NeuralCanvas";
import { NeuronDetailPanel, type DetailTab } from "./NeuronDetailPanel";
import { Button } from "./ui/Button";

type LearningMapProps = {
  subject: Subject;
  neurons: Neuron[];
  connections: NeuronConnection[];
  mapExpanded: boolean;
  onToggleMapExpanded: () => void;
  selection: Selection;
  notice: string | null;
  onToggleSidebar?: () => void;
  onSelectNeuron: (neuronId: string) => void;
  onSelectConnection: (connectionId: string) => void;
  onLayoutSettled: (positions: Record<string, Position3D>) => void;
  graphLoading?: boolean;
  graphError?: string | null;
  detailInitialTab?: DetailTab;
  onCreateNeuron: (neuron: Neuron) => Promise<Neuron>;
  onCreateConnection: (sourceId: string, targetId: string) => void | Promise<void>;
  onUpdateNeuron: (neuron: Neuron) => void;
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
  onToggleSidebar,
  onSelectNeuron,
  graphLoading,
  graphError,
  detailInitialTab,
  onSelectConnection,
  onLayoutSettled,
  onCreateNeuron,
  onCreateConnection,
  onUpdateNeuron,
  onDeleteNeuron,
  onUpdateConnection,
  onDeleteConnection,
}: LearningMapProps) {
  const canvasRef = useRef<NeuralCanvasHandle>(null);
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
    <main className={`nm-workspace${selectedNeuron ? " is-neuron-detail" : ""}`}>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="nm-toolbar">
          {onToggleSidebar ? (
            <Button variant="icon" className="nm-toolbar-menu" aria-label="Menu" onClick={onToggleSidebar}>
              <Menu size={18} />
            </Button>
          ) : null}
          <div className="nm-toolbar-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm neuron..." aria-label="Tìm neuron" />
            {filteredNeurons.length > 0 ? (
              <div className="nm-toolbar-results">
                {filteredNeurons.map((neuron) => (
                  <button key={neuron.id} type="button" onClick={() => focusNeuron(neuron.id)}>
                    <span>{neuron.name}</span>
                    <span className="sidebar-space-dot" style={{ backgroundColor: neuron.color }} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <label className="nm-toolbar-spacing">
            <span>Khoảng cách neuron</span>
            <input type="range" min="1.5" max="5" step="0.1" value={neuronSpacing} onChange={(event) => setNeuronSpacing(Number(event.target.value))} />
            <output>{neuronSpacing.toFixed(1)}</output>
          </label>
          <div className="nm-toolbar-actions">
            <Button variant="primary" size="sm" data-onboarding="create-neuron" onClick={() => setShowCreateNeuron(true)}>
              <Plus size={16} />Tạo neuron
            </Button>
            <Button variant={connectionMode ? "primary" : "secondary"} size="sm" data-onboarding="create-connection" onClick={() => setConnectionMode((value) => !value)}>
              <Link2 size={16} />{connectionMode ? "Đang tạo liên kết" : "Tạo liên kết"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setResetSignal((value) => value + 1)}>
              <RotateCcw size={16} />Reset View
            </Button>
            <Button variant="icon" title={mapExpanded ? "Thu nhỏ sơ đồ" : "Mở rộng sơ đồ"} aria-label={mapExpanded ? "Thu nhỏ sơ đồ" : "Mở rộng sơ đồ"} onClick={onToggleMapExpanded}>
              {mapExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </Button>
          </div>
        </header>
        {notice ? <div className="nm-notice">{notice}</div> : null}

        <div className={`learning-map-layout min-h-0 flex-1 overflow-hidden ${selectedNeuron ? "has-neuron-detail" : ""}`}>
          <div className="nm-graph-stage" data-onboarding="graph">
            <div className="nm-graph-tools">
              <Button variant="icon" title="Chọn" aria-label="Chọn" onClick={() => setConnectionMode(false)}>
                <MousePointer2 size={16} />
              </Button>
              <Button variant="icon" title="Vừa khung" aria-label="Vừa khung" onClick={() => canvasRef.current?.fit()}>
                <Maximize2 size={16} />
              </Button>
            </div>
            {selectedConnection && !connectionMode ? (
              <Button variant="danger" size="sm" className="nm-graph-delete" onClick={() => { setDeleteError(""); setPendingDelete(selectedConnection); }}>
                <Trash2 size={16} />Xóa liên kết
              </Button>
            ) : null}
            {toast ? <div role="status" className="nm-toast">{toast}</div> : null}
            <NeuralCanvas
              ref={canvasRef}
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
            <div className="nm-zoom">
              <Button variant="icon" aria-label="Phóng to" onClick={() => canvasRef.current?.zoomBy(1.15)}><Plus size={16} /></Button>
              <Button variant="icon" aria-label="Thu nhỏ" onClick={() => canvasRef.current?.zoomBy(1 / 1.15)}><Minus size={16} /></Button>
            </div>
            {graphLoading ? <div className="nm-graph-status">Đang tải sơ đồ...</div> : null}
            {graphError ? <div className="nm-graph-error">{graphError}</div> : null}
            {!graphLoading && neurons.length === 0 ? (
              <div className="nm-graph-empty">
                <h3>Không gian này chưa có neuron.</h3>
                <p>Tạo neuron đầu tiên</p>
                <Button variant="primary" onClick={() => setShowCreateNeuron(true)}>
                  <Plus size={16} />Tạo neuron đầu tiên
                </Button>
              </div>
            ) : null}
          </div>

          {selectedNeuron ? (
            <div
              className="learning-map-detail-pane"
              onWheel={(event) => event.stopPropagation()}
            >
              <NeuronDetailPanel
                neuron={selectedNeuron}
                neurons={neurons}
                connections={connections}
                connectionCount={getConnectionCount(selectedNeuron.id, connections)}
                onClose={() => onSelectNeuron("")}
                onDelete={onDeleteNeuron}
                onUpdate={onUpdateNeuron}
                onSelectNeuron={focusNeuron}
                onToggleSidebar={onToggleSidebar}
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
          <Button variant="secondary" autoFocus disabled={deleteBusy} onClick={() => setPendingDelete(null)}>Hủy</Button>
          <Button variant="danger" disabled={deleteBusy} onClick={() => void confirmDeleteConnection()}><Trash2 size={16} />{deleteBusy ? "Đang xóa..." : "Xóa liên kết"}</Button>
        </div>
      </dialog>
      {showCreateNeuron && (
        <CreateNeuronModal
          subjectId={subject.id}
          neuronCount={neurons.length}
          onClose={() => setShowCreateNeuron(false)}
          onCreate={onCreateNeuron}
        />
      )}
    </main>
  );
}
