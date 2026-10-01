import { ArrowRight, Check, Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Neuron, NeuronConnection, Subject } from "../types";
import { areSameConnection } from "../utils/neuron";
import { Button } from "./ui/Button";

type NeuronConnectionsProps = {
  subject: Subject;
  neurons: Neuron[];
  connections: NeuronConnection[];
  loading: boolean;
  error: string | null;
  onCreateConnection: (sourceId: string, targetId: string, explanation: string) => Promise<void>;
};

export function NeuronConnections({
  subject,
  neurons,
  connections,
  loading,
  error,
  onCreateConnection,
}: NeuronConnectionsProps) {
  const [selectedSourceNeuronId, setSelectedSourceNeuronId] = useState<string | null>(null);
  const [selectedTargetNeuronId, setSelectedTargetNeuronId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);

  const source = neurons.find((neuron) => neuron.id === selectedSourceNeuronId) ?? null;
  const target = neurons.find((neuron) => neuron.id === selectedTargetNeuronId) ?? null;
  const duplicate = useMemo(
    () =>
      Boolean(
        source &&
          target &&
          connections.some((connection) =>
            areSameConnection(source.id, target.id, connection.sourceNeuronId, connection.targetNeuronId),
          ),
      ),
    [connections, source, target],
  );

  const toggleNeuron = (neuronId: string) => {
    setSubmitError("");
    if (selectedSourceNeuronId === neuronId) {
      setSelectedSourceNeuronId(selectedTargetNeuronId);
      setSelectedTargetNeuronId(null);
      return;
    }
    if (selectedTargetNeuronId === neuronId) {
      setSelectedTargetNeuronId(null);
      return;
    }
    if (!selectedSourceNeuronId) {
      setSelectedSourceNeuronId(neuronId);
      return;
    }
    if (!selectedTargetNeuronId) setSelectedTargetNeuronId(neuronId);
  };

  const createConnection = async () => {
    if (!source || !target || duplicate || !explanation.trim()) return;
    setBusy(true);
    setSubmitError("");
    try {
      await onCreateConnection(source.id, target.id, explanation.trim());
      setSelectedSourceNeuronId(null);
      setSelectedTargetNeuronId(null);
      setExplanation("");
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "Không tạo được liên kết.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="dashboard-main min-h-screen min-w-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10">
      <header className="mb-7">
        <div className="flex items-center gap-3">
          <Link2 className="text-emerald-400" size={24} />
          <h1 className="text-3xl font-bold text-white">Liên kết neuron</h1>
        </div>
        <p className="mt-2 text-sm text-[#94a39b]">{subject.name} · Chọn 2 neuron để tạo liên kết</p>
      </header>

      {loading ? <p className="text-sm text-slate-400">Đang tải neuron...</p> : null}
      {error ? <p className="rounded-md border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</p> : null}

      {!loading && !error ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {neurons.map((neuron, index) => {
            const selected = neuron.id === selectedSourceNeuronId || neuron.id === selectedTargetNeuronId;
            return (
              <button
                key={neuron.id}
                type="button"
                onClick={() => toggleNeuron(neuron.id)}
                className={`relative min-h-32 rounded-lg border p-4 text-center transition ${
                  selected
                    ? "border-emerald-400 bg-emerald-400/10 shadow-[0_0_16px_rgba(34,197,94,0.16)]"
                    : "border-white/10 bg-[#0f1b2d] hover:border-white/25 hover:bg-[#132239]"
                }`}
              >
                {selected ? (
                  <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white">
                    <Check size={13} />
                  </span>
                ) : null}
                <span
                  className="mx-auto block h-9 w-9 rounded-full shadow-[0_0_14px_currentColor]"
                  style={{ backgroundColor: neuron.color, color: neuron.color }}
                />
                <span className="mt-3 block text-sm font-bold text-white">{String(index + 1).padStart(2, "0")}</span>
                <span className="mt-1 block truncate text-xs text-slate-400" title={neuron.name}>{neuron.name}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {!loading && neurons.length === 0 ? <p className="text-sm text-slate-400">Chưa có neuron để liên kết.</p> : null}

      <section className="mt-8 border-t border-white/10 pt-6">
        <p className="text-sm font-semibold text-slate-300">Đã chọn</p>
        <div className="mt-3 flex min-h-10 items-center gap-3 text-base font-bold text-white">
          <span>{source?.name ?? "Neuron thứ nhất"}</span>
          <ArrowRight size={18} className="text-emerald-400" />
          <span>{target?.name ?? "Neuron thứ hai"}</span>
        </div>

        {source && target ? (
          <label className="mt-5 block max-w-2xl">
            <span className="text-sm font-semibold text-slate-300">Liên kết như thế nào?</span>
            <textarea
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              rows={3}
              className="mt-2 w-full resize-none rounded-md border border-white/15 bg-[#0f1b2d] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
              placeholder="Giải thích mối liên hệ giữa hai kiến thức..."
            />
          </label>
        ) : null}

        {duplicate ? <p className="mt-3 text-sm text-amber-300">Hai neuron này đã được liên kết.</p> : null}
        {submitError ? <p className="mt-3 text-sm text-red-300">{submitError}</p> : null}

        <Button
          type="button"
          variant="primary"
          onClick={createConnection}
          disabled={!source || !target || duplicate || !explanation.trim() || busy}
          className="mt-5"
        >
          <Link2 />{busy ? "Đang tạo..." : "Tạo liên kết"}
        </Button>
      </section>
    </main>
  );
}
