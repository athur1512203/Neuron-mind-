import {
  BookOpen,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Music2,
  Pencil,
  Plus,
  Settings,
  StickyNote,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { Neuron, NeuronConnection } from "../types";
import { colorPresets } from "../utils/neuron";

type NeuronDetailPanelProps = {
  neuron: Neuron;
  connections: NeuronConnection[];
  neurons: Neuron[];
  connectionCount: number;
  onClose: () => void;
  onDelete: (neuronId: string) => Promise<void>;
  onUpdate: (neuron: Neuron) => void;
};

type ActiveSection = "knowledge" | "note" | "application" | "settings";

export function NeuronDetailPanel({ neuron, connectionCount, onClose, onDelete, onUpdate }: NeuronDetailPanelProps) {
  const [activeSection, setActiveSection] = useState<ActiveSection>("knowledge");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(neuron);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(neuron);
    setEditing(false);
    setActiveSection("knowledge");
    setShowDeleteConfirm(false);
    setDeleting(false);
    setDeleteError("");
  }, [neuron]);

  const save = () => {
    onUpdate({
      ...draft,
      updatedAt: new Date().toISOString(),
    });
    setEditing(false);
  };

  const startEdit = () => {
    setDraft(neuron);
    setEditing((value) => !value);
  };

  const addLocalFiles = (files: FileList | null, kind: "images" | "audio") => {
    if (!files?.length) return;
    const urls = Array.from(files).map((file) => URL.createObjectURL(file));
    setDraft((current) => ({ ...current, [kind]: [...current[kind], ...urls] }));
    setEditing(true);
  };

  const openDeleteConfirm = () => {
    setDeleteError("");
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDelete(neuron.id);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Không xóa được neuron. Vui lòng thử lại.");
      setDeleting(false);
    }
  };

  return (
    <>
    <aside className="flex h-[min(320px,42vh)] w-full shrink-0 flex-col overflow-hidden border-t border-[#1b2a3d] bg-[#071322] text-white">
      <header className="shrink-0 border-b border-[#1b2a3d] bg-[#071322]">
        <div className="flex items-start justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="h-9 w-9 shrink-0 rounded-full"
              style={{
                backgroundColor: neuron.color,
                background: `radial-gradient(circle at 35% 25%, #ffffff 0%, ${neuron.color} 22%, ${neuron.color} 72%)`,
                boxShadow: `0 0 20px ${neuron.color}70`,
              }}
            />
            <div className="min-w-0">
              <h2 className="app-name truncate text-lg text-white">{neuron.name}</h2>
              <span className="app-metadata text-sm text-slate-500">{connectionCount} kết nối</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button onClick={startEdit} className="action-3d-button">
              <span className="btn-shadow" />
              <span className="btn-edge" />
              <span className="btn-front">
                <Pencil />
                Chỉnh sửa
              </span>
            </button>
            <button onClick={openDeleteConfirm} className="action-3d-button danger">
              <span className="btn-shadow" />
              <span className="btn-edge" />
              <span className="btn-front">
                <Trash2 />
                Xóa neuron
              </span>
            </button>
            <button onClick={onClose} className="button button-icon" aria-label="Đóng">
              <div>
                <span>
                  <X size={17} />
                </span>
              </div>
            </button>
          </div>
        </div>
      </header>

    <div className="neuronDetailBody border-2 border-white/90 rounded-xl mb-4">
        <NeuronSectionMenu activeSection={activeSection} onSelect={setActiveSection} />

        <main className="neuronDetailContent panel-scroll mb-3 mr-3">
          <section className={`neuronContentCard neuronContentCard${activeSection === "knowledge" ? "Knowledge" : activeSection === "note" ? "Note" : activeSection === "application" ? "Application" : "Settings"}`}>
          {editing && activeSection === "knowledge" ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Tên kiến thức" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
                <div className="neuronContentInputWrap">
                  <div className="neuronContentSectionLabel">Màu neuron</div>
                  <div className="flex flex-wrap gap-3">
                    {colorPresets.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setDraft({ ...draft, color: preset.value })}
                        className={`h-8 w-8 rounded-full border-2 ${draft.color === preset.value ? "border-white" : "border-transparent"}`}
                        style={{ backgroundColor: preset.value, boxShadow: `0 0 10px ${preset.value}60` }}
                        title={preset.label}
                      />
                    ))}
                    <input
                      type="color"
                      value={draft.color}
                      onChange={(event) => setDraft({ ...draft, color: event.target.value })}
                      className="h-8 w-12 rounded border border-slate-700 bg-transparent"
                    />
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Textarea label="Nội dung học" value={draft.textContent} onChange={(value) => setDraft({ ...draft, textContent: value })} />
                <Textarea label="Trọng tâm kiến thức" value={draft.keyPoints} onChange={(value) => setDraft({ ...draft, keyPoints: value })} />
              </div>
            </div>
          ) : null}

          {editing && activeSection === "note" ? (
            <NoteEditor
              draft={draft}
              imageInputRef={imageInputRef}
              audioInputRef={audioInputRef}
              onMemoryChange={(value) => setDraft({ ...draft, memoryMethod: value })}
              onRemoveImage={(index) => setDraft({ ...draft, images: draft.images.filter((_, i) => i !== index) })}
              onRemoveAudio={(index) => setDraft({ ...draft, audio: draft.audio.filter((_, i) => i !== index) })}
            />
          ) : null}

          {editing && activeSection === "application" ? (
            <Textarea label="Áp dụng kiến thức" value={draft.application} onChange={(value) => setDraft({ ...draft, application: value })} />
          ) : null}

          {!editing && activeSection === "knowledge" ? (
            <KnowledgeCard textContent={neuron.textContent} keyPoints={neuron.keyPoints} />
          ) : null}

          {!editing && activeSection === "note" ? (
            <NoteView
              neuron={neuron}
              onAddText={() => {
                setActiveSection("note");
                setEditing(true);
              }}
              onPickImages={() => {
                setActiveSection("note");
                imageInputRef.current?.click();
              }}
              onPickAudio={() => {
                setActiveSection("note");
                audioInputRef.current?.click();
              }}
            />
          ) : null}

          {!editing && activeSection === "application" ? <ApplicationCard body={neuron.application} /> : null}

          {activeSection === "settings" ? (
            <div>
              <div className="neuronContentHeader">
                <span className="neuronContentHeaderIcon">
                  <Settings size={16} />
                </span>
                <span className="font-fancy">TÙY CHỌN</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(neuron);
                    setEditing(true);
                    setActiveSection("knowledge");
                  }}
                  className="neuronContentBtn neuronContentBtnSave"
                >
                  Chỉnh sửa
                </button>
                <button type="button" onClick={openDeleteConfirm} className="neuronContentBtn neuronContentBtnDanger">
                  Xóa neuron
                </button>
              </div>
            </div>
          ) : null}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              addLocalFiles(event.target.files, "images");
              event.target.value = "";
            }}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={(event) => {
              addLocalFiles(event.target.files, "audio");
              event.target.value = "";
            }}
          />

          {editing && activeSection !== "settings" ? (
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDraft(neuron);
                  setEditing(false);
                }}
                className="neuronContentBtn neuronContentBtnGhost"
              >
                Hủy
              </button>
              <button type="button" onClick={save} className="neuronContentBtn neuronContentBtnSave">
                Lưu thay đổi
              </button>
            </div>
          ) : null}
          </section>
        </main>
      </div>
    </aside>
    {showDeleteConfirm ? (
      <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-neuron-title"
          className="w-full max-w-md rounded-xl border border-red-500/35 bg-[#071322] p-6 text-white shadow-2xl"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-red-500/35 bg-red-500/10 text-red-400">
              <Trash2 size={20} />
            </div>
            <div>
              <h3 id="delete-neuron-title" className="text-lg font-bold">Xóa neuron</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Bạn có chắc muốn xóa neuron &quot;{neuron.name}&quot; không?
              </p>
              <p className="mt-1 text-sm leading-6 text-red-300">
                Neuron và các liên kết liên quan sẽ bị xóa.
              </p>
            </div>
          </div>

          {deleteError ? (
            <div className="mt-4 rounded-md border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {deleteError}
            </div>
          ) : null}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setShowDeleteConfirm(false)}
              className="neuronContentBtn neuronContentBtnGhost disabled:cursor-not-allowed disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={confirmDelete}
              className="neuronContentBtn neuronContentBtnDanger disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={16} />
              {deleting ? "Đang xóa..." : "Xóa neuron"}
            </button>
          </div>
        </section>
      </div>
    ) : null}
    </>
  );
}

function NeuronSectionMenu({
  activeSection,
  onSelect,
}: {
  activeSection: ActiveSection;
  onSelect: (section: ActiveSection) => void;
}) {
  return (
    <nav className="neuronSectionMenu" aria-label="Mục neuron">
      <div className="neuronSectionMenuTop">
        <button
          type="button"
          className={`neuronSectionButton neuronSectionButtonKnowledge ${activeSection === "knowledge" ? "is-active" : ""}`}
          aria-label="Kiến thức"
          onClick={() => onSelect("knowledge")}
        >
          <BookOpen size={22} />
        </button>
        <button
          type="button"
          className={`neuronSectionButton neuronSectionButtonNote ${activeSection === "note" ? "is-active" : ""}`}
          aria-label="Note"
          onClick={() => onSelect("note")}
        >
          <FileText size={22} />
        </button>
      </div>
      <div className="neuronSectionMenuBottom">
        <button
          type="button"
          className={`neuronSectionButton neuronSectionButtonApplication ${activeSection === "application" ? "is-active" : ""}`}
          aria-label="Áp dụng"
          onClick={() => onSelect("application")}
        >
          <Lightbulb size={22} />
        </button>
        <button
          type="button"
          className={`neuronSectionButton neuronSectionButtonSettings ${activeSection === "settings" ? "is-active" : ""}`}
          aria-label="Tùy chọn"
          onClick={() => onSelect("settings")}
        >
          <Settings size={22} />
        </button>
      </div>
    </nav>
  );
}

function KnowledgeCard({ textContent, keyPoints }: { textContent: string; keyPoints: string }) {
  return (
    <div>
      <div className="neuronContentHeader">
        <span className="neuronContentHeaderIcon">
          <BookOpen size={16} />
        </span>
        <span className="font-fancy">KIẾN THỨC</span>
      </div>
      <div>
        <h3 className="neuronContentSectionLabel">Nội dung học</h3>
        <p className="neuronContentBody">{textContent || "Chưa có nội dung."}</p>
      </div>
      <div className="neuronContentDivider" />
      <div>
        <h3 className="neuronContentSectionLabel">Trọng tâm</h3>
        <p className="neuronContentBody">{keyPoints || "Chưa có nội dung."}</p>
      </div>
    </div>
  );
}

function ApplicationCard({ body }: { body: string }) {
  return (
    <div>
      <div className="neuronContentHeader">
        <span className="neuronContentHeaderIcon">
          <Lightbulb size={16} />
        </span>
        <span className="font-fancy">ÁP DỤNG</span>
      </div>
      <p className="neuronContentBody">{body || "Chưa có nội dung."}</p>
    </div>
  );
}

function NoteView({
  neuron,
  onAddText,
  onPickImages,
  onPickAudio,
}: {
  neuron: Neuron;
  onAddText: () => void;
  onPickImages: () => void;
  onPickAudio: () => void;
}) {
  const hasNotes = Boolean(neuron.memoryMethod.trim()) || neuron.images.length > 0 || neuron.audio.length > 0;

  return (
    <div>
      <div className="neuronContentHeader">
        <span className="neuronContentHeaderIcon">
          <FileText size={16} />
        </span>
        <span className="font-fancy">NOTE</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <NoteToolButton onClick={onAddText}>
          <Type size={14} />+ Text
        </NoteToolButton>
        <NoteToolButton onClick={onPickImages}>
          <ImageIcon size={14} />+ Hình ảnh
        </NoteToolButton>
        <NoteToolButton onClick={onPickAudio}>
          <Music2 size={14} />+ Âm thanh
        </NoteToolButton>
      </div>

      {hasNotes ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {neuron.memoryMethod.trim() ? (
            <NoteCard kind="TEXT NOTE" title="Cách ghi nhớ">
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{neuron.memoryMethod}</p>
            </NoteCard>
          ) : null}
          {neuron.images.map((src, index) => (
            <NoteCard key={`${src}-${index}`} kind="IMAGE">
              <img src={src} alt={`${neuron.name} ${index + 1}`} className="max-h-28 w-full rounded object-cover" />
            </NoteCard>
          ))}
          {neuron.audio.map((src, index) => (
            <NoteCard key={`${src}-${index}`} kind="AUDIO">
              <audio controls src={src} className="w-full" />
            </NoteCard>
          ))}
        </div>
      ) : (
        <EmptyState text="Chưa có note. Thêm text, hình ảnh hoặc âm thanh." />
      )}
    </div>
  );
}

function NoteEditor({
  draft,
  imageInputRef,
  audioInputRef,
  onMemoryChange,
  onRemoveImage,
  onRemoveAudio,
}: {
  draft: Neuron;
  imageInputRef: RefObject<HTMLInputElement | null>;
  audioInputRef: RefObject<HTMLInputElement | null>;
  onMemoryChange: (value: string) => void;
  onRemoveImage: (index: number) => void;
  onRemoveAudio: (index: number) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <NoteToolButton onClick={() => undefined}>
          <StickyNote size={14} />
          Text note
        </NoteToolButton>
        <NoteToolButton onClick={() => imageInputRef.current?.click()}>
          <Plus size={14} />
          Hình ảnh
        </NoteToolButton>
        <NoteToolButton onClick={() => audioInputRef.current?.click()}>
          <Plus size={14} />
          Âm thanh
        </NoteToolButton>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Textarea label="Cách ghi nhớ" value={draft.memoryMethod} onChange={onMemoryChange} />
        {draft.images.map((src, index) => (
          <NoteCard key={`${src}-${index}`} kind="IMAGE" onRemove={() => onRemoveImage(index)}>
            <img src={src} alt="" className="max-h-28 w-full rounded object-cover" />
          </NoteCard>
        ))}
        {draft.audio.map((src, index) => (
          <NoteCard key={`${src}-${index}`} kind="AUDIO" onRemove={() => onRemoveAudio(index)}>
            <audio controls src={src} className="w-full" />
          </NoteCard>
        ))}
      </div>
    </div>
  );
}

function NoteToolButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-emerald-500/40 hover:text-white"
    >
      {children}
    </button>
  );
}

function NoteCard({
  kind,
  title,
  children,
  onRemove,
}: {
  kind: string;
  title?: string;
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <section className="neuronContentNoteItem relative min-h-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-fancy text-xs tracking-wide text-emerald-300">{kind}</span>
        {onRemove ? (
          <button type="button" onClick={onRemove} className="text-slate-500 hover:text-red-400" aria-label="Xóa note">
            <X size={14} />
          </button>
        ) : null}
      </div>
      {title ? <h3 className="mb-2 text-sm font-semibold text-white">{title}</h3> : null}
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="neuronContentBody"> {text}</div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="neuronContentInputWrap">
      <span className="neuronContentSectionLabel">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="neuronContentInput" />
    </label>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="neuronContentInputWrap">
      <span className="neuronContentSectionLabel">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="neuronContentInput" />
    </label>
  );
}
