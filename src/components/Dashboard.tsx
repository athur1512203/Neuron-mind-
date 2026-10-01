import { useMemo, useState } from "react";
import { Layers, Plus, Search } from "lucide-react";
import type { Subject } from "../types";
import { CreateSubjectModal } from "./CreateSubjectModal";
import { DashboardStats } from "./DashboardStats";
import { RecentActivity } from "./RecentActivity";
import { SubjectCard } from "./SubjectCard";
import { Button } from "./ui/Button";

type DashboardProps = {
  subjects: Subject[];
  loading?: boolean;
  error?: string | null;
  onOpenSubject: (subjectId: string) => void;
  onCreateSubject: (payload: { name: string; color: string }) => Promise<void>;
  onDeleteSubject: (subjectId: string) => Promise<void>;
};

export function Dashboard({
  subjects,
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

  const openCreate = () => setShowCreate(true);
  const isEmpty = !loading && subjects.length === 0;

  return (
    <main className="nm-dashboard flex-1 overflow-auto">
      <div className="nm-dashboard-inner">
        <header className="nm-dashboard-header">
          <div>
            <h1>Dashboard</h1>
            <p>Quản lý các không gian và mạng lưới thông tin của bạn.</p>
          </div>
          <Button variant="primary" onClick={openCreate}>
            <Plus size={18} />
            Tạo không gian
          </Button>
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
              {!isEmpty ? (
                <label className="nm-search">
                  <Search size={16} aria-hidden="true" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Tìm không gian..."
                    aria-label="Tìm không gian"
                  />
                </label>
              ) : null}
            </div>

            {isEmpty ? (
              <div className="nm-workspace-empty">
                <p className="nm-empty">Chưa có Không gian.</p>
                <Button variant="primary" onClick={openCreate}>
                  <Plus size={18} />
                  Tạo không gian
                </Button>
              </div>
            ) : (
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
              </div>
            )}
          </section>

          {!isEmpty ? <RecentActivity subjects={subjects} onOpenSubject={onOpenSubject} /> : null}
        </div>
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
              <Button variant="secondary" disabled={deleteBusy} onClick={() => setPendingDelete(null)}>
                Hủy
              </Button>
              <Button
                variant="danger"
                disabled={deleteBusy}
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
              </Button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
