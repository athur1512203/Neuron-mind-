import { useEffect, useRef, useState } from "react";
import type { DocumentMeta } from "../api/documents";
import { getNeuronMarkdown } from "../api/markdownNotes";
import { parseStoredDocument } from "../markdown/documentEditor";
import { saveWorkingNote } from "../markdown/noteAutosave";
import { neuronMarkdownStore } from "../markdown/neuronMarkdownStore";
import type { Neuron, NeuronConnection } from "../types";
import { areSameConnection } from "../utils/neuron";
import { VisualNoteEditor } from "./VisualNoteEditor";

type SaveStatus = "saved" | "unsaved" | "saving" | "error";
type Props = { neuronId: string; neurons?: Neuron[]; documents?: DocumentMeta[]; connections?: NeuronConnection[];
  onSaved?: (content: string) => void; onEnsureConnection?: (targetNeuronId: string) => void | Promise<void>; onSelectNeuron?: (neuronId: string) => void };

/** A single WYSIWYG editor. Legacy Markdown is converted in memory and replaced only after a real edit. */
export function NeuronMarkdownEditor({ neuronId, neurons = [], documents = [], connections = [], onSaved, onEnsureConnection, onSelectNeuron }: Props) {
  const mounted = useRef(true), saving = useRef(false), loadRequest = useRef(0);
  const relationPending = useRef(new Map<string, Promise<void>>());
  const [value, setValue] = useState(() => neuronMarkdownStore.getWorking(neuronId));
  const [status, setStatus] = useState<SaveStatus>(() => neuronMarkdownStore.isDirty(neuronId) ? "unsaved" : "saved");

  useEffect(() => {
    const requestId = ++loadRequest.current, controller = new AbortController();
    const savedAtLoad = neuronMarkdownStore.getSaved(neuronId), workingAtLoad = neuronMarkdownStore.getWorking(neuronId);
    setValue(workingAtLoad); setStatus(neuronMarkdownStore.isDirty(neuronId) ? "unsaved" : "saved");
    void getNeuronMarkdown(neuronId, controller.signal).then((note) => {
      if (controller.signal.aborted || requestId !== loadRequest.current) return;
      if (neuronMarkdownStore.getSaved(neuronId) !== savedAtLoad || neuronMarkdownStore.getWorking(neuronId) !== workingAtLoad) return;
      const source = note.content ?? "";
      if (!neuronMarkdownStore.applyServer(neuronId, source)) return;
      parseStoredDocument(source); // Validate without migrating a read-only note.
      setValue(source); setStatus("saved");
    }).catch((error: unknown) => {
      if (!controller.signal.aborted && requestId === loadRequest.current && !(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
    });
    return () => controller.abort();
  }, [neuronId]);

  const save = async () => {
    if (saving.current || !neuronMarkdownStore.isDirty(neuronId)) return;
    saving.current = true; setStatus("saving");
    try {
      const snapshot = await saveWorkingNote(neuronId);
      if (mounted.current) { setStatus(neuronMarkdownStore.isDirty(neuronId) ? "unsaved" : "saved"); onSaved?.(snapshot); }
    } catch { if (mounted.current) setStatus("error"); }
    finally { saving.current = false; }
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (neuronMarkdownStore.isDirty(neuronId)) void saveWorkingNote(neuronId).catch(() => {}); };
  }, [neuronId]);
  useEffect(() => {
    if (!neuronMarkdownStore.isDirty(neuronId)) return;
    const timer = window.setTimeout(() => void save(), 800);
    return () => window.clearTimeout(timer);
  }, [value, neuronId]);

  const ensureRelation = (targetId: string): Promise<void> => {
    const current = neurons.find((item) => item.id === neuronId), target = neurons.find((item) => item.id === targetId);
    if (!current || !target || current.subjectId !== target.subjectId || targetId === neuronId) return Promise.reject(new Error("Invalid target"));
    if (connections.some((item) => areSameConnection(neuronId, targetId, item.sourceNeuronId, item.targetNeuronId))) return Promise.resolve();
    const active = relationPending.current.get(targetId); if (active) return active;
    if (!onEnsureConnection) return Promise.reject(new Error("Relation unavailable"));
    const request = Promise.resolve(onEnsureConnection(targetId)).finally(() => relationPending.current.delete(targetId));
    relationPending.current.set(targetId, request); return request;
  };

  const change = (next: string) => {
    if (next === value) return;
    setValue(next); neuronMarkdownStore.setWorking(neuronId, next); setStatus("unsaved");
  };

  return <section className="neuron-md" onKeyDown={(event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void save(); }
  }}>
    <VisualNoteEditor value={value} onChange={change} neurons={neurons} documents={documents} neuronId={neuronId}
      onEnsureConnection={ensureRelation} onSelectNeuron={onSelectNeuron} />
    <span className="nm-note-save-indicator" role="status" aria-live="polite">
      {status === "saving" ? "Đang lưu…" : status === "error" ? "Lưu thất bại" : ""}
    </span>
  </section>;
}
