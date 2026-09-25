import { ArrowLeft, Link2, Maximize2, Minimize2, Plus, RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Neuron, NeuronConnection, Position3D, Selection, Subject } from "../types";
import { getConnectionCount } from "../utils/neuron";
import { ConnectionDetailPanel } from "./ConnectionDetailPanel";
import { CreateConnectionModal } from "./CreateConnectionModal";
import { CreateNeuronModal } from "./CreateNeuronModal";
import { NeuralCanvas } from "./NeuralCanvas";
import { NeuronDetailPanel } from "./NeuronDetailPanel";

type LearningMapProps = {
  subject: Subject;
  neurons: Neuron[];
  connections: NeuronConnection[];
  mapExpanded: boolean;
  onToggleMapExpanded: () => void;
  selection: Selection;
  isConnecting: boolean;
  connectionSourceId: string | null;
  notice: string | null;
  onBack: () => void;
  onSelectNeuron: (neuronId: string) => void;
  onSelectConnection: (connectionId: string) => void;
  onLayoutSettled: (positions: Record<string, Position3D>) => void;
  graphLoading?: boolean;
  graphError?: string | null;
  onCreateNeuron: (neuron: Neuron) => void | Promise<void>;
  onUpdateNeuron: (neuron: Neuron) => void;
  onDeleteNeuron: (neuronId: string) => Promise<void>;
  onStartConnection: () => void;
  pendingConnection: { source: Neuron; target: Neuron } | null;
  onCancelConnection: () => void;
  onCreateConnection: (explanation: string) => void | Promise<void>;
  onUpdateConnection: (connection: NeuronConnection) => void;
  onDeleteConnection: (connectionId: string) => void;
};

export function LearningMap({
  subject,
  neurons,
  connections,
  mapExpanded,
  onToggleMapExpanded,
  selection,
  isConnecting,
  connectionSourceId,
  notice,
  onBack,
  onSelectNeuron,
  graphLoading,
  graphError,
  onSelectConnection,
  onLayoutSettled,
  onCreateNeuron,
  onUpdateNeuron,
  onDeleteNeuron,
  onStartConnection,
  pendingConnection,
  onCancelConnection,
  onCreateConnection,
  onUpdateConnection,
  onDeleteConnection,
}: LearningMapProps) {
  const [showCreateNeuron, setShowCreateNeuron] = useState(false);
  const [query, setQuery] = useState("");
  const [focusNeuronId, setFocusNeuronId] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);

  const filteredNeurons = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    if (!lowered) return [];
    return neurons.filter((neuron) => neuron.name.toLowerCase().includes(lowered));
  }, [neurons, query]);

  const selectedNeuron = selection?.type === "neuron" ? neurons.find((neuron) => neuron.id === selection.id) : null;
  const selectedConnection =
    selection?.type === "connection" ? connections.find((connection) => connection.id === selection.id) : null;
  const selectedSource = selectedConnection ? neurons.find((neuron) => neuron.id === selectedConnection.sourceNeuronId) : null;
  const selectedTarget = selectedConnection ? neurons.find((neuron) => neuron.id === selectedConnection.targetNeuronId) : null;
  const selectedNeuronConnections = selectedNeuron
    ? connections.filter(
        (connection) => connection.sourceNeuronId === selectedNeuron.id || connection.targetNeuronId === selectedNeuron.id,
      )
    : [];

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
              <button
                onClick={onStartConnection}
                className="action-3d-button"
              >
                <span className="btn-shadow" />
                <span className="btn-edge" />
                <span className="btn-front"><Link2 />Tạo liên kết</span>
              </button>
              <button
                onClick={() => setShowCreateNeuron(true)}
                className="action-3d-button"
              >
                <span className="btn-shadow" />
                <span className="btn-edge" />
                <span className="btn-front"><Plus />Tạo neuron</span>
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
          {isConnecting && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {connectionSourceId ? "Chọn neuron thứ hai" : "Chọn neuron thứ nhất"}
            </div>
          )}
          {notice && <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{notice}</div>}
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-0 min-w-0 flex-1 p-4">
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
            <NeuralCanvas
              neurons={neurons}
              connections={connections}
              selectedNeuronId={selectedNeuron?.id ?? null}
              selectedConnectionId={selectedConnection?.id ?? null}
              connectionSourceId={connectionSourceId}
              focusNeuronId={focusNeuronId}
              resetSignal={resetSignal}
              onSelectNeuron={onSelectNeuron}
              onSelectConnection={onSelectConnection}
              onLayoutSettled={onLayoutSettled}
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
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-6">
                <div className="pointer-events-auto max-w-sm rounded-xl border border-slate-700/80 bg-slate-950/90 px-6 py-5 text-center shadow-xl">
                  <h3 className="text-lg font-semibold text-white">Chưa có neuron nào</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Thêm kiến thức đầu tiên để bắt đầu xây dựng mạng neuron.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateNeuron(true)}
                    className="action-3d-button dashboard-add-button mt-4"
                  >
                    <span className="btn-shadow" />
                    <span className="btn-edge" />
                    <span className="btn-front">
                      <Plus />
                      Tạo neuron đầu tiên
                    </span>
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>

          {selectedNeuron && (
            <NeuronDetailPanel
              neuron={selectedNeuron}
              neurons={neurons}
              connections={selectedNeuronConnections}
              connectionCount={getConnectionCount(selectedNeuron.id, connections)}
              onClose={() => onSelectNeuron("")}
              onDelete={onDeleteNeuron}
              onUpdate={onUpdateNeuron}
            />
          )}

          {selectedConnection && selectedSource && selectedTarget && (
            <div className="w-full shrink-0 [&_aside]:h-[min(280px,38vh)] [&_aside]:w-full">
              <ConnectionDetailPanel
                connection={selectedConnection}
                source={selectedSource}
                target={selectedTarget}
                onClose={() => onSelectConnection("")}
                onDelete={onDeleteConnection}
                onUpdate={onUpdateConnection}
              />
            </div>
          )}
        </div>
      </section>

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

      {pendingConnection && (
        <CreateConnectionModal
          source={pendingConnection.source}
          target={pendingConnection.target}
          onCancel={onCancelConnection}
          onCreate={onCreateConnection}
        />
      )}
    </main>
  );
}
