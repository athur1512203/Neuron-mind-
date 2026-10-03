import {
  Check,
  Menu,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import type { Neuron, NeuronConnection } from "../types";
import { NeuronColorPicker } from "./NeuronColorPicker";
import { NeuronMarkdownEditor } from "./NeuronMarkdownEditor";
import { Button } from "./ui/Button";

export type DetailTab = "markdown" | "custom";

type NeuronDetailPanelProps = {
  neuron: Neuron;
  connections: NeuronConnection[];
  neurons: Neuron[];
  connectionCount: number;

  onClose: () => void;
  onDelete: (neuronId: string) => Promise<void>;
  onUpdate: (neuron: Neuron) => void;
  onSelectNeuron: (neuronId: string) => void;

  onToggleSidebar?: () => void;
  initialTab?: DetailTab;
};

export function NeuronDetailPanel({
  neuron,
  connectionCount,
  onClose,
  onDelete,
  onUpdate,
  onToggleSidebar,
  initialTab = "markdown",
}: NeuronDetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>(initialTab);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(neuron);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    setTab(initialTab);
    setEditing(false);
    setDraft(neuron);

    setShowDeleteConfirm(false);
    setDeleting(false);
    setDeleteError("");
  }, [initialTab, neuron.id]);

  useEffect(() => {
    if (!editing) {
      setDraft(neuron);
    }
  }, [editing, neuron]);

  const saveDraft = () => {
    onUpdate({
      ...draft,
      updatedAt: new Date().toISOString(),
    });

    setEditing(false);
  };

  const confirmDelete = async () => {
    if (deleting) return;

    setDeleting(true);
    setDeleteError("");

    try {
      await onDelete(neuron.id);
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Không xóa được neuron. Vui lòng thử lại.",
      );

      setDeleting(false);
    }
  };

  return (
    <>
      <aside
        className="neuron-workspace neuron-detail-panel"
        onWheel={(event) => event.stopPropagation()}
      >
        <NeuronDetailHeader
          neuron={neuron}
          draftColor={draft.color}
          connectionCount={connectionCount}
          editing={editing}
          onToggleSidebar={onToggleSidebar}
          onEdit={() => {
            if (editing) {
              saveDraft();
              return;
            }

            setEditing(true);
          }}
          onDelete={() => setShowDeleteConfirm(true)}
          onClose={onClose}
        />

        <NeuronTabs
          tab={tab}
          onChange={setTab}
        />

        <div
          className={`neuron-workspace-scroll${
            tab === "markdown" ? " is-markdown" : ""
          }`}
        >
          {tab === "markdown" ? (
            <NeuronMarkdownEditor
              key={neuron.id}
              neuronId={neuron.id}
            />
          ) : null}

          {tab === "custom" ? (
            <NeuronCustom
              color={draft.color}
              onColorChange={(color) => {
                if (!editing) {
                  setEditing(true);
                }

                setDraft((current) => ({
                  ...current,
                  color,
                }));
              }}
            />
          ) : null}

          {editing && tab === "custom" ? (
            <div className="nm-overview-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft(neuron);
                  setEditing(false);
                }}
              >
                Hủy
              </Button>

              <Button
                variant="primary"
                onClick={saveDraft}
              >
                <Check size={16} />
                Lưu thay đổi
              </Button>
            </div>
          ) : null}
        </div>
      </aside>

      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/70 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-neuron-title"
            className="brutal-dialog"
          >
            <h3
              id="delete-neuron-title"
              className="text-xl font-black"
            >
              Xóa neuron
            </h3>

            <p className="mt-3 text-sm font-semibold">
              Bạn có chắc muốn xóa neuron &quot;{neuron.name}&quot; không?
            </p>

            <p className="mt-2 text-sm">
              Neuron và các liên kết liên quan sẽ bị xóa.
            </p>

            {deleteError ? (
              <p className="mt-4 border-2 border-red-700 bg-red-100 p-3 text-sm font-bold text-red-800">
                {deleteError}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="secondary"
                disabled={deleting}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Hủy
              </Button>

              <Button
                variant="danger"
                disabled={deleting}
                onClick={confirmDelete}
              >
                <Trash2 size={16} />
                {deleting ? "Đang xóa..." : "Xóa neuron"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function NeuronDetailHeader({
  neuron,
  draftColor,
  connectionCount,
  editing,
  onToggleSidebar,
  onEdit,
  onDelete,
  onClose,
}: {
  neuron: Neuron;
  draftColor: string;
  connectionCount: number;
  editing: boolean;
  onToggleSidebar?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <header className="neuron-workspace-header">
      <div className="flex min-w-0 items-center gap-3">
        {onToggleSidebar ? (
          <Button
            variant="icon"
            className="nm-toolbar-menu"
            aria-label="Menu"
            onClick={onToggleSidebar}
          >
            <Menu size={18} />
          </Button>
        ) : null}

        <span
          className="nm-neuron-swatch"
          style={{
            backgroundColor: editing
              ? draftColor
              : neuron.color,
          }}
        />

        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-[#191515]">
            {neuron.name}
          </h2>

          <p className="mt-0.5 text-xs text-[#746A65]">
            {connectionCount} kết nối
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onEdit}
        >
          {editing ? "Lưu" : "Chỉnh sửa"}
        </Button>

        <Button
          variant="danger"
          size="sm"
          onClick={onDelete}
        >
          Xóa
        </Button>

        <Button
          variant="icon"
          onClick={onClose}
          aria-label="Đóng"
        >
          <X size={17} />
        </Button>
      </div>
    </header>
  );
}

function NeuronTabs({
  tab,
  onChange,
}: {
  tab: DetailTab;
  onChange: (tab: DetailTab) => void;
}) {
  const tabs: Array<{
    id: DetailTab;
    label: string;
  }> = [
    {
      id: "markdown",
      label: "Ghi chú",
    },
    {
      id: "custom",
      label: "Tùy chỉnh",
    },
  ];

  return (
    <nav
      className="neuron-workspace-tabs"
      aria-label="Chi tiết neuron"
    >
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`nm-tab ${
            tab === item.id ? "is-active" : ""
          }`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function BrutalCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="nm-detail-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="nm-detail-card-title">
          {title}
        </h3>

        {action}
      </div>

      {children}
    </section>
  );
}

function NeuronCustom({
  color,
  onColorChange,
}: {
  color: string;
  onColorChange: (color: string) => void;
}) {
  return (
    <div className="nm-custom-page">
      <BrutalCard title="Màu neuron">
        <NeuronColorPicker
          value={color}
          onChange={onColorChange}
        />
      </BrutalCard>

      <BrutalCard title="Hình ảnh">
        <p className="text-sm font-semibold text-[#666666]">
          Sắp có. Upload ảnh chưa được lưu trên máy chủ.
        </p>
      </BrutalCard>

      <BrutalCard title="Âm thanh">
        <p className="text-sm font-semibold text-[#666666]">
          Sắp có. Upload audio chưa được lưu trên máy chủ.
        </p>
      </BrutalCard>
    </div>
  );
}