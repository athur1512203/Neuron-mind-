import {
  BookOpen,
  Image as ImageIcon,
  MoreHorizontal,
  Music2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import applicationIcon from "../assets/icons/application.svg";
import contentIcon from "../assets/icons/content.svg";
import focusIcon from "../assets/icons/focus.svg";
import memoryIcon from "../assets/icons/memory.svg";
import type { Neuron, NeuronConnection } from "../types";
import { colorPresets } from "../utils/neuron";

type NeuronDetailPanelProps = {
  neuron: Neuron;
  connections: NeuronConnection[];
  neurons: Neuron[];
  connectionCount: number;
  onClose: () => void;
  
  onDelete: (neuronId: string) => void;
  onUpdate: (neuron: Neuron) => void;
};

type Tab = "content" | "images" | "audio";

export function NeuronDetailPanel({
  neuron,
  connectionCount,
  onClose,
  onDelete,
  onUpdate,
}: NeuronDetailPanelProps) {
  const [tab, setTab] = useState<Tab>("content");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(neuron);

  useEffect(() => {
    setDraft(neuron);
    setEditing(false);
    setTab("content");
  }, [neuron]);

  const save = () => {
    onUpdate({
      ...draft,
      updatedAt: new Date().toISOString(),
    });

    setEditing(false);
  };

  return (
    <aside className="flex h-full w-[420px] shrink-0 flex-col overflow-hidden border-l border-[#1b2a3d] bg-[#071322] text-white">
          <header className="shrink-0 border-b border-[#1b2a3d] bg-[#071322]">
            <div className="flex items-start justify-between gap-3 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="h-10 w-10 shrink-0 rounded-full"
                  style={{
                    backgroundColor: neuron.color,
                    background: `radial-gradient(circle at 35% 25%, #ffffff 0%, ${neuron.color} 22%, ${neuron.color} 72%)`,
                    boxShadow: `0 0 20px ${neuron.color}70`,
                  }}
                />

                <div className="min-w-0">
                  <h2 className="app-name truncate text-xl text-white">
                    {neuron.name}
                  </h2>

                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <span className="app-metadata text-slate-500">
                      {connectionCount} kết nối
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
              
                <button
                  onClick={() => {
                    setDraft(neuron);
                    setEditing((value) => !value);
                  }}
                  className="action-3d-button"
                >
                  <span className="btn-shadow" />
                  <span className="btn-edge" />
                  <span className="btn-front"><Pencil />Chỉnh sửa</span>
                </button>

                <button
                  onClick={onClose}
                  className="button button-icon"
                  aria-label="Đóng"
                >
                  <div>
                    <span>
                      <X size={17} />
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* =========================
                TABS
            ========================== */}
            {!editing && (
              <div className="overflow-x-auto px-4 pb-4 pt-1">
                <div className="flex w-max min-w-max items-center gap-1 rounded-full border border-slate-700/60 bg-slate-900/75 p-1.5 shadow-lg backdrop-blur-md">
                  <TabButton
                    active={tab === "content"}
                    onClick={() => setTab("content")}
                  >
                    <BookOpen size={16} />
                    Nội dung
                  </TabButton>

                  <TabButton
                    active={tab === "images"}
                    onClick={() => setTab("images")}
                  >
                    <ImageIcon size={15} />
                    Hình ảnh ({neuron.images.length})
                  </TabButton>

                  <TabButton
                    active={tab === "audio"}
                    onClick={() => setTab("audio")}
                  >
                    <Music2 size={15} />
                    Âm thanh ({neuron.audio.length})
                  </TabButton>
                </div>
              </div>
            )}
          </header>

          {/* SCROLL CONTENT */}
          <main className="panel-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">

            {/* =========================
                EDIT MODE
            ========================== */}
            {editing ? (
              <div className="mx-auto max-w-full space-y-5">
                <Field
                  label="Tên kiến thức"
                  value={draft.name}
                  onChange={(value) =>
                    setDraft({ ...draft, name: value })
                  }
                />

                <div className="app-card p-5">
                  <div className="mb-3 text-sm font-medium text-slate-300">
                    Màu neuron
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {colorPresets.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            color: preset.value,
                          })
                        }
                        className={`h-8 w-8 rounded-full border-2 ${
                          draft.color === preset.value
                            ? "border-white"
                            : "border-transparent"
                        }`}
                        style={{
                          backgroundColor: preset.value,
                          boxShadow: `0 0 10px ${preset.value}60`,
                        }}
                        title={preset.label}
                      />
                    ))}

                    <input
                      type="color"
                      value={draft.color}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          color: event.target.value,
                        })
                      }
                      className="h-8 w-12 rounded border border-slate-700 bg-transparent"
                    />
                  </div>
                </div>

                <Textarea
                  label="Nội dung học"
                  value={draft.textContent}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      textContent: value,
                    })
                  }
                />

                <Textarea
                  label="Trọng tâm kiến thức"
                  value={draft.keyPoints}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      keyPoints: value,
                    })
                  }
                />

                <Textarea
                  label="Cách ghi nhớ"
                  value={draft.memoryMethod}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      memoryMethod: value,
                    })
                  }
                />

                <Textarea
                  label="Áp dụng"
                  value={draft.application}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      application: value,
                    })
                  }
                />

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setDraft(neuron);
                      setEditing(false);
                    }}
                    className="action-3d-button secondary"
                  >
                    <span className="btn-shadow" />
                    <span className="btn-edge" />
                    <span className="btn-front">Hủy</span>
                  </button>

                  <button
                    onClick={save}
                    className="action-3d-button"
                  >
                    <span className="btn-shadow" />
                    <span className="btn-edge" />
                    <span className="btn-front">Lưu thay đổi</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* =========================
                    CONTENT TAB
                ========================== */}
                {tab === "content" && (
                  <div className="space-y-5">
                    <DetailCard
                      title="Nội dung học"
                      body={neuron.textContent}
                      icon={contentIcon}
                      tone="green"
                    />

                    <DetailCard
                      title="Trọng tâm kiến thức"
                      body={neuron.keyPoints}
                      icon={focusIcon}
                      tone="purple"
                    />

                    <DetailCard
                      title="Cách ghi nhớ"
                      body={neuron.memoryMethod}
                      icon={memoryIcon}
                      tone="blue"
                    />

                    <DetailCard
                      title="Áp dụng"
                      body={neuron.application}
                      icon={applicationIcon}
                      tone="gold"
                    />
                  </div>
                )}

                {/* =========================
                    IMAGE TAB
                ========================== */}
                {tab === "images" && (
                  <div>
                    <div className="mb-5">
                      <h3 className="text-lg font-semibold">
                        Hình ảnh minh họa
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {neuron.images.length} hình ảnh
                      </p>
                    </div>

                    {neuron.images.length ? (
                      <div className="grid gap-4">
                        {neuron.images.map((src, index) => (
                          <div
                            key={`${src}-${index}`}
                            className="app-card overflow-hidden"
                          >
                            <img
                              src={src}
                              alt={`${neuron.name} ${index + 1}`}
                              className="aspect-video w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState text="Chưa có hình ảnh." />
                    )}
                  </div>
                )}

                {/* =========================
                    AUDIO TAB
                ========================== */}
                {tab === "audio" && (
                  <div>
                    <div className="mb-5">
                      <h3 className="text-lg font-semibold">
                        Âm thanh
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {neuron.audio.length} file âm thanh
                      </p>
                    </div>

                    {neuron.audio.length ? (
                      <div className="space-y-3">
                        {neuron.audio.map((src, index) => (
                          <div
                            key={`${src}-${index}`}
                            className="app-card p-4"
                          >
                            <div className="mb-3 text-sm font-medium text-slate-300">
                              Âm thanh {index + 1}
                            </div>

                            <audio
                              controls
                              src={src}
                              className="w-full"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState text="Chưa có âm thanh." />
                    )}
                  </div>
                )}
              </>
            )}

            {/* DELETE */}
            {!editing && (
              <div className="mt-8 border-t border-slate-800 pt-6">
                <button
                  onClick={() => onDelete(neuron.id)}
                  className="action-3d-button danger"
                >
                  <span className="btn-shadow" />
                  <span className="btn-edge" />
                  <span className="btn-front"><Trash2 />Xóa neuron</span>
                </button>
              </div>
            )}
          </main>
    </aside>
  );
}

/* ==================================================
   SMALL COMPONENTS
================================================== */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-all duration-200 ease-out hover:scale-105 active:scale-95 ${
        active
          ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-300 shadow-[0_0_18px_rgba(250,204,21,0.12)]"
          : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

const cardTones = {
  green: {
    card: "neuron-card-green",
    icon: "border-emerald-500/45 bg-emerald-500/15",
  },
  purple: {
    card: "neuron-card-purple",
    icon: "border-purple-500/45 bg-purple-500/15",
  },
  blue: {
    card: "neuron-card-blue",
    icon: "border-blue-500/50 bg-blue-500/15",
  },
  gold: {
    card: "neuron-card-yellow",
    icon: "border-amber-500/45 bg-amber-500/15",
  },
} as const;

function DetailCard({
  title,
  body,
  icon,
  tone,
}: {
  title: string;
  body: string;
  icon: string;
  tone: keyof typeof cardTones;
}) {
  const styles = cardTones[tone];

  return (
    <section className={`neuron-card relative min-h-[174px] p-6 ${styles.card}`}>
      <button
        type="button"
        className="absolute right-5 top-4 rounded-md p-1 text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
        aria-label={`Tùy chọn ${title}`}
      >
        <MoreHorizontal size={20} />
      </button>

      <div className="relative z-10 flex items-start gap-6 pr-7">
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border ${styles.icon}`}>
          <img src={icon} alt="" className="h-12 w-12" />
        </div>

        <div className="min-w-0 pt-1">
          <h3 className="text-xl font-semibold text-white">{title}</h3>
          <p className="mt-4 whitespace-pre-wrap text-base leading-7 text-slate-200">
            {body || "Chưa có nội dung."}
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute -bottom-12 -right-10 h-28 w-72 rounded-[50%] bg-white/[0.025] blur-sm" />
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="app-card p-12 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="app-card block p-5">
      <span className="text-sm font-medium text-slate-300">
        {label}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full rounded-lg border border-slate-700 bg-[#07101f] px-4 py-3 text-sm text-white outline-none focus:border-yellow-500"
      />
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="app-card block p-5">
      <span className="text-sm font-medium text-slate-300">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        className="mt-3 w-full resize-y rounded-lg border border-slate-700 bg-[#07101f] px-4 py-3 text-sm leading-6 text-white outline-none focus:border-yellow-500"
      />
    </label>
  );
}
