import {
  Check,
  FileText,
  Menu,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { DocumentMeta } from "../api/documents";
import type { Neuron, NeuronConnection } from "../types";
import { NeuronColorPicker } from "./NeuronColorPicker";
import { NeuronMarkdownEditor } from "./NeuronMarkdownEditor";
import { Button } from "./ui/Button";

export type DetailTab = "overview" | "markdown" | "custom";

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
  connections,
  neurons,
  connectionCount,
  onClose,
  onDelete,
  onUpdate,
  onSelectNeuron,
  onToggleSidebar,
  initialTab = "overview",
}: NeuronDetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>(initialTab);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(neuron);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const directConnections = useMemo(
    () => connections.filter((connection) => connection.sourceNeuronId === neuron.id || connection.targetNeuronId === neuron.id),
    [connections, neuron.id],
  );
  const linkedNeurons = useMemo(
    () =>
      directConnections
        .map((connection) => {
          const linkedId = connection.sourceNeuronId === neuron.id ? connection.targetNeuronId : connection.sourceNeuronId;
          return neurons.find((item) => item.id === linkedId) ?? null;
        })
        .filter((item): item is Neuron => Boolean(item)),
    [directConnections, neuron.id, neurons],
  );

  useEffect(() => {
    setTab(initialTab);
    setEditing(false);
    setDraft(neuron);
    setShowDeleteConfirm(false);
    setDeleting(false);
    setDeleteError("");
  }, [initialTab, neuron.id]);

  useEffect(() => {
    if (!editing) setDraft(neuron);
  }, [editing, neuron]);

  const saveDraft = () => {
    onUpdate({ ...draft, updatedAt: new Date().toISOString() });
    setEditing(false);
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
          onEdit={() => (editing ? saveDraft() : setEditing(true))}
          onDelete={() => setShowDeleteConfirm(true)}
          onClose={onClose}
        />
        <NeuronTabs tab={tab} onChange={setTab} />

        <div className={`neuron-workspace-scroll${tab === "markdown" ? " is-markdown" : ""}`}>
          {tab === "overview" ? (
            <NeuronOverview
              neuron={neuron}
              draft={draft}
              editing={editing}
              connectionCount={connectionCount}
              linkedNeurons={linkedNeurons}
              allConnections={connections}
              onDraftChange={setDraft}
              onSelectNeuron={onSelectNeuron}
            />
          ) : null}
          {tab === "markdown" ? <NeuronMarkdownEditor key={neuron.id} neuronId={neuron.id} /> : null}
          {tab === "custom" ? (
            <NeuronCustom
              color={draft.color}
              onColorChange={(color) => {
                if (!editing) setEditing(true);
                setDraft((current) => ({ ...current, color }));
              }}
            />
          ) : null}

          {editing && (tab === "overview" || tab === "custom") ? (
            <div className="nm-overview-actions">
              <Button variant="secondary" onClick={() => { setDraft(neuron); setEditing(false); }}>Hủy</Button>
              <Button variant="primary" onClick={saveDraft}><Check size={16} />Lưu thay đổi</Button>
            </div>
          ) : null}
        </div>

      </aside>

      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/70 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="delete-neuron-title" className="brutal-dialog">
            <h3 id="delete-neuron-title" className="text-xl font-black">Xóa neuron</h3>
            <p className="mt-3 text-sm font-semibold">Bạn có chắc muốn xóa neuron &quot;{neuron.name}&quot; không?</p>
            <p className="mt-2 text-sm">Neuron và các liên kết liên quan sẽ bị xóa.</p>
            {deleteError ? <p className="mt-4 border-2 border-red-700 bg-red-100 p-3 text-sm font-bold text-red-800">{deleteError}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" disabled={deleting} onClick={() => setShowDeleteConfirm(false)}>Hủy</Button>
              <Button variant="danger" disabled={deleting} onClick={confirmDelete}><Trash2 size={16} />{deleting ? "Đang xóa..." : "Xóa neuron"}</Button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function NeuronDetailHeader({ neuron, draftColor, connectionCount, editing, onToggleSidebar, onEdit, onDelete, onClose }: {
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
          <Button variant="icon" className="nm-toolbar-menu" aria-label="Menu" onClick={onToggleSidebar}>
            <Menu size={18} />
          </Button>
        ) : null}
        <span className="nm-neuron-swatch" style={{ backgroundColor: editing ? draftColor : neuron.color }} />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-[#191515]">{neuron.name}</h2>
          <p className="mt-0.5 text-xs text-[#746A65]">{connectionCount} kết nối</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onEdit}>{editing ? "Lưu" : "Chỉnh sửa"}</Button>
        <Button variant="danger" size="sm" onClick={onDelete}>Xóa</Button>
        <Button variant="icon" onClick={onClose} aria-label="Đóng"><X size={17} /></Button>
      </div>
    </header>
  );
}

function NeuronTabs({ tab, onChange }: { tab: DetailTab; onChange: (tab: DetailTab) => void }) {
  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "overview", label: "Tổng quan" },
    { id: "markdown", label: "Note Markdown" },
    { id: "custom", label: "Tùy chỉnh" },
  ];
  return (
    <nav className="neuron-workspace-tabs" aria-label="Chi tiết neuron">
      {tabs.map((item) => (
        <button key={item.id} type="button" onClick={() => onChange(item.id)} className={`nm-tab ${tab === item.id ? "is-active" : ""}`}>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function NeuronOverview({ neuron, draft, editing, connectionCount, linkedNeurons, allConnections, onDraftChange, onSelectNeuron }: {
  neuron: Neuron;
  draft: Neuron;
  editing: boolean;
  connectionCount: number;
  linkedNeurons: Neuron[];
  allConnections: NeuronConnection[];
  onDraftChange: (neuron: Neuron) => void;
  onSelectNeuron: (id: string) => void;
}) {
  return (
    <div className="nm-overview">
      <BrutalCard title="Thông tin cơ bản">
        <dl className="brutal-info-list">
          <InfoRow label="Tên neuron" value={editing ? <input className="nm-input" value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} /> : neuron.name} />
          <InfoRow label="Số kết nối" value={String(connectionCount)} />
          <InfoRow label="Ngày tạo" value={formatDate(neuron.createdAt)} />
          <InfoRow label="Cập nhật cuối" value={formatDate(neuron.updatedAt)} />
        </dl>
      </BrutalCard>

      <BrutalCard title="Neuron liên kết">
        <LinkedNeuronList linkedNeurons={linkedNeurons} allConnections={allConnections} onSelectNeuron={onSelectNeuron} />
      </BrutalCard>
    </div>
  );
}

function BrutalCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section className="nm-detail-card"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="nm-detail-card-title">{title}</h3>{action}</div>{children}</section>;
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function LinkedNeuronList({ linkedNeurons, allConnections, onSelectNeuron, full = false }: { linkedNeurons: Neuron[]; allConnections: NeuronConnection[]; onSelectNeuron: (id: string) => void; full?: boolean }) {
  if (!linkedNeurons.length) return <p className="text-sm font-semibold text-[#666666]">Chưa có neuron liên kết.</p>;
  return (
    <div className={full ? "brutal-card" : "space-y-2"}>
      {full ? <h3 className="mb-4 text-sm font-black uppercase">Tất cả neuron liên kết</h3> : null}
      <div className="space-y-2">
        {linkedNeurons.map((linked) => {
          const count = allConnections.filter((connection) => connection.sourceNeuronId === linked.id || connection.targetNeuronId === linked.id).length;
          return (
            <button key={linked.id} type="button" onClick={() => onSelectNeuron(linked.id)} className="brutal-linked-row">
              <span className="h-3 w-3 shrink-0 rounded-full border-2 border-black bg-slate-500" />
              <span className="min-w-0 flex-1 text-left"><strong className="block truncate">{linked.name}</strong><small>{count} kết nối</small></span>
              <span aria-hidden="true">›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NeuronDocuments({
  notice,
  documents,
  loading,
  uploading,
  deletingId,
  downloadingId,
  onPickDocuments,
  onDocumentFiles,
  onDownloadDocument,
  onDeleteDocument,
}: {
  notice: string;
  documents: DocumentMeta[];
  loading: boolean;
  uploading: boolean;
  deletingId: string | null;
  downloadingId: string | null;
  onPickDocuments: () => void;
  onDocumentFiles: (files: FileList | null) => void;
  onDownloadDocument: (document: DocumentMeta) => void;
  onDeleteDocument: (document: DocumentMeta) => void;
}) {
  return (
    <div className="nm-docs">
      <header className="nm-docs-head">
        <div>
          <h3>Tài liệu</h3>
          <p>Các tài liệu liên quan đến neuron.</p>
        </div>
        <Button variant="primary" size="sm" onClick={onPickDocuments}>
          <Plus size={15} /> Thêm tài liệu
        </Button>
      </header>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onDocumentFiles(event.dataTransfer.files);
        }}
      >
        {uploading ? <p className="nm-docs-status">Uploading...</p> : null}
        {notice ? <p className="nm-docs-status">{notice}</p> : null}
        {loading ? <p className="nm-docs-status">Đang tải tài liệu...</p> : null}
        {!loading && !documents.length ? (
          <div className="nm-docs-empty">
            <p>Chưa có tài liệu</p>
            <p>Thêm tài liệu để lưu cùng neuron này.</p>
            <Button variant="primary" size="sm" onClick={onPickDocuments}>
              <Plus size={15} /> Thêm tài liệu
            </Button>
          </div>
        ) : null}
        {!loading && documents.length ? (
          <div className="nm-docs-list">
            {documents.map((document) => (
              <div key={document.id} className="nm-doc-row">
                <FileText size={18} />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{document.originalName}</strong>
                  <small>{formatType(document)} • {formatFileSize(document.size)}</small>
                </span>
                <Button variant="secondary" size="sm" onClick={() => onDownloadDocument(document)} disabled={Boolean(downloadingId)}>
                  {downloadingId === document.id ? "Đang tải..." : "Tải xuống"}
                </Button>
                <Button variant="danger" size="sm" onClick={() => onDeleteDocument(document)} disabled={Boolean(deletingId)}>
                  {deletingId === document.id ? "Đang xóa..." : "Xóa"}
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NeuronCustom({ color, onColorChange }: { color: string; onColorChange: (color: string) => void }) {
  return (
    <div className="nm-custom-page">
      <BrutalCard title="Màu neuron">
        <NeuronColorPicker value={color} onChange={onColorChange} />
      </BrutalCard>
      <BrutalCard title="Hình ảnh">
        <p className="text-sm font-semibold text-[#666666]">Sắp có. Upload ảnh chưa được lưu trên máy chủ.</p>
      </BrutalCard>
      <BrutalCard title="Âm thanh">
        <p className="text-sm font-semibold text-[#666666]">Sắp có. Upload audio chưa được lưu trên máy chủ.</p>
      </BrutalCard>
    </div>
  );
}

function formatType(document: DocumentMeta) {
  const ext = document.extension.replace(/^\./, "").toUpperCase();
  if (ext) return ext;
  const subtype = document.mimeType.split("/")[1];
  return subtype ? subtype.toUpperCase() : document.mimeType;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Không xác định" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
