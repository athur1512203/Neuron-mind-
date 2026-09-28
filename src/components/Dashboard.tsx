import { useMemo, useState } from "react";
import { Layers, Plus, Search } from "lucide-react";
import type { Neuron, Subject } from "../types";
import { CreateSubjectModal } from "./CreateSubjectModal";
import { DashboardStats } from "./DashboardStats";
import { RecentActivity } from "./RecentActivity";
import { SubjectCard } from "./SubjectCard";

type DashboardProps = {
  subjects: Subject[];
  neurons?: Neuron[];
  loading?: boolean;
  error?: string | null;
  onOpenSubject: (subjectId: string) => void;
  onCreateSubject: (payload: { name: string; description: string; color: string }) => Promise<void>;
  onDeleteSubject: (subjectId: string) => Promise<void>;
};

export function Dashboard({
  subjects,
  neurons = [],
  loading,
  error,
  onOpenSubject,
  onCreateSubject,
  onDeleteSubject,
}: DashboardProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Subject | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [query, setQuery] = useState("");

  const filteredSubjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return subjects;
    return subjects.filter((subject) => subject.name.toLowerCase().includes(needle));
  }, [subjects, query]);

  const neuronTotal = subjects.reduce((sum, subject) => sum + subject.neuronCount, 0);
  const connectionTotal = subjects.reduce((sum, subject) => sum + subject.connectionCount, 0);
  const average = neuronTotal === 0 ? 0 : connectionTotal / neuronTotal;
  const barMax = Math.max(neuronTotal, connectionTotal, 1);

  const openCreate = () => setShowCreate(true);

  return (
    <main className="nm-dashboard flex-1 overflow-auto">
      <div className="nm-dashboard-inner">
        <header className="nm-dashboard-header">
          <div>
            <h1>Dashboard</h1>
            <p>Quản lý các không gian và mạng lưới thông tin của bạn.</p>
          </div>
          <button type="button" onClick={openCreate} className="nm-create-button">
            <Plus size={18} />
            Tạo không gian
          </button>
        </header>

        {loading ? <p className="nm-status">Đang tải không gian...</p> : null}
        {error ? <p className="nm-status nm-status-error">{error}</p> : null}

        <DashboardStats subjects={subjects} />

        <div className="nm-dashboard-main">
          <section className="nm-workspace-panel">
            <div className="nm-workspace-panel-head">
              <h2 className="nm-panel-title">
                <Layers size={18} />
                Không gian của tôi
              </h2>
              <label className="nm-search">
                <Search size={16} aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm không gian..."
                  aria-label="Tìm không gian"
                />
              </label>
            </div>

            <div className="nm-workspace-grid">
              {filteredSubjects.map((subject) => (
                <SubjectCard
                  key={subject.id}
                  subject={subject}
                  onOpen={onOpenSubject}
                  onDelete={(item) => {
                    setDeleteError("");
                    setPendingDelete(item);
                  }}
                />
              ))}
              <button type="button" className="nm-create-card" onClick={openCreate}>
                <Plus size={28} />
                Tạo không gian
              </button>
            </div>
          </section>

          <RecentActivity neurons={neurons} subjects={subjects} onOpenSubject={onOpenSubject} />
        </div>

        <section className="nm-network">
          <h2 className="nm-panel-title">Tổng quan mạng lưới</h2>
          <div className="nm-network-rows">
            <NetworkBar label="Tổng neuron" value={neuronTotal} max={barMax} />
            <NetworkBar label="Tổng kết nối" value={connectionTotal} max={barMax} />
            <p className="nm-network-average">
              Trung bình kết nối / neuron: <strong>{average.toFixed(2)}</strong>
            </p>
          </div>
        </section>
      </div>

      {showCreate && (
        <CreateSubjectModal
          onClose={() => setShowCreate(false)}
          onCreate={async (payload) => {
            await onCreateSubject(payload);
            setShowCreate(false);
          }}
        />
      )}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => !deleteBusy && setPendingDelete(null)}>
          <section className="nm-delete-modal" onClick={(event) => event.stopPropagation()}>
            <h2>Xóa không gian này?</h2>
            <p>Toàn bộ neuron và liên kết trong không gian này cũng sẽ bị xóa.</p>
            {deleteError ? <p className="nm-status-error">{deleteError}</p> : null}
            <div className="nm-delete-actions">
              <button type="button" disabled={deleteBusy} onClick={() => setPendingDelete(null)} className="nm-ghost-button">
                Hủy
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                className="nm-create-button"
                onClick={async () => {
                  setDeleteBusy(true);
                  setDeleteError("");
                  try {
                    await onDeleteSubject(pendingDelete.id);
                    setPendingDelete(null);
                  } catch (caught) {
                    setDeleteError(caught instanceof Error ? caught.message : "Không xóa được không gian.");
                  } finally {
                    setDeleteBusy(false);
                  }
                }}
              >
                {deleteBusy ? "Đang xóa..." : "Xóa không gian"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function NetworkBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = `${Math.max(4, Math.round((value / max) * 100))}%`;
  return (
    <div className="nm-bar-row">
      <div className="nm-bar-label">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="nm-bar-track">
        <div className="nm-bar-fill" style={{ width }} />
      </div>
    </div>
  );
}
